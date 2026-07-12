from __future__ import annotations

import os
import logging
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional

from dependencies import (
    get_service_supabase,
    get_current_user_id,
)
from services.inference import extract_embedding

from slowapi import Limiter
from slowapi.util import get_remote_address
import cv2
import numpy as np

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dogs", tags=["dogs"])
limiter = Limiter(key_func=get_remote_address)

# Configuration from environment
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "8"))
MAX_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
ALLOWED_UPLOAD_TYPES = os.getenv(
    "ALLOWED_UPLOAD_TYPES", "image/jpeg,image/png,image/webp"
).split(",")
MATCH_THRESHOLD = float(os.getenv("MATCH_THRESHOLD", "0.75"))
ACTIVE_EMBEDDING_VERSION = os.getenv("ACTIVE_EMBEDDING_VERSION", "v1")
IDENTIFY_RATE_LIMIT = os.getenv("IDENTIFY_RATE_LIMIT", "10/minute")


# --- Request/Response models ---

class DogCreate(BaseModel):
    name: str
    breed: Optional[str] = None


class DogResponse(BaseModel):
    id: str
    name: str
    breed: Optional[str] = None


class DogListItem(BaseModel):
    id: str
    name: str
    breed: Optional[str] = None
    nose_print_count: int = 0


class MatchCandidate(BaseModel):
    dog_id: str
    name: str
    breed: Optional[str] = None
    similarity: float
    is_match: bool


class IdentifyResponse(BaseModel):
    result: str  # "match" or "no_match"
    matches: List[MatchCandidate]


# --- Image validation helper ---

async def validate_image(request: Request, file: UploadFile) -> bytes:
    """Validate uploaded image: check type, size, and decodability."""
    if file.content_type not in ALLOWED_UPLOAD_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_UPLOAD_TYPES)}",
        )

    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE_MB}MB.",
        )

    content = await file.read()
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE_MB}MB.",
        )

    # Verify the image is decodable
    nparr = np.frombuffer(content, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image file or format")

    # Re-encode as JPEG for consistent processing
    success, buffer = cv2.imencode(".jpg", img)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to process image")

    return buffer.tobytes()


# --- Endpoints ---

@router.post("", response_model=DogResponse)
def register_dog(
    dog: DogCreate,
    user_id: str = Depends(get_current_user_id),
):
    """
    Register a new dog profile.
    Uses service-role client to bypass RLS and insert with the verified user_id.
    """
    supabase = get_service_supabase()
    data = {
        "owner_id": user_id,
        "name": dog.name,
        "breed": dog.breed,
    }

    res = supabase.table("dogs").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create dog")

    row = res.data[0]
    return DogResponse(id=row["id"], name=row["name"], breed=row.get("breed"))


@router.get("", response_model=List[DogListItem])
def list_dogs(
    user_id: str = Depends(get_current_user_id),
):
    """
    List all dogs owned by the authenticated user, with nose print counts.
    """
    supabase = get_service_supabase()

    # Fetch dogs for this user
    dogs_res = (
        supabase.table("dogs")
        .select("id, name, breed")
        .eq("owner_id", user_id)
        .execute()
    )

    if not dogs_res.data:
        return []

    # Fetch nose_prints for these dogs to count them
    dog_ids = [d["id"] for d in dogs_res.data]
    counts_res = (
        supabase.table("nose_prints")
        .select("dog_id")
        .in_("dog_id", dog_ids)
        .execute()
    )

    # Build a count map from nose_prints rows
    count_map: dict[str, int] = {}
    if counts_res.data:
        for row in counts_res.data:
            did = row["dog_id"]
            count_map[did] = count_map.get(did, 0) + 1

    return [
        DogListItem(
            id=d["id"],
            name=d["name"],
            breed=d.get("breed"),
            nose_print_count=count_map.get(d["id"], 0),
        )
        for d in dogs_res.data
    ]


@router.post("/{dog_id}/enroll")
@limiter.limit("10/minute")
async def enroll_dog(
    request: Request,
    dog_id: str,
    nose_image: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
):
    """
    Enroll a nose photo for a dog. Runs ML pipeline and stores embedding.
    Field name is 'nose_image' to match the frontend FormData key.
    """
    image_bytes = await validate_image(request, nose_image)

    # Verify the dog belongs to this user
    supabase = get_service_supabase()
    dog_check = (
        supabase.table("dogs")
        .select("id")
        .eq("id", dog_id)
        .eq("owner_id", user_id)
        .execute()
    )
    if not dog_check.data:
        raise HTTPException(
            status_code=403, detail="Dog not found or you don't own this dog"
        )

    # Run ML pipeline
    try:
        embedding = extract_embedding(image_bytes, ACTIVE_EMBEDDING_VERSION)
    except ValueError as e:
        msg = str(e)
        if "no_nose_detected" in msg:
            raise HTTPException(status_code=422, detail="no_nose_detected")
        raise HTTPException(status_code=422, detail=msg)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Store embedding
    data = {
        "dog_id": dog_id,
        "embedding": embedding.tolist(),
        "embedding_version": ACTIVE_EMBEDDING_VERSION,
    }

    try:
        res = supabase.table("nose_prints").insert(data).execute()
    except Exception as e:
        logger.error(f"Failed to insert nose print: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to store nose print embedding"
        )

    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to enroll dog")

    return {"nose_print_id": res.data[0]["id"]}


@router.post("/identify")
@limiter.limit(IDENTIFY_RATE_LIMIT)
async def identify_dog(
    request: Request,
    nose_image: UploadFile = File(...),
):
    """
    Identify a dog from a nose photo. No auth required.
    Runs ML pipeline, then queries pgvector for top-3 matches.
    """
    image_bytes = await validate_image(request, nose_image)

    # Run ML pipeline
    try:
        embedding = extract_embedding(image_bytes, ACTIVE_EMBEDDING_VERSION)
    except ValueError as e:
        msg = str(e)
        if "no_nose_detected" in msg:
            raise HTTPException(status_code=422, detail="no_nose_detected")
        raise HTTPException(status_code=422, detail=msg)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Query pgvector via the match_all_dogs RPC function
    supabase = get_service_supabase()

    try:
        res = supabase.rpc(
            "match_all_dogs",
            {
                "query_embedding": embedding.tolist(),
                "match_threshold": MATCH_THRESHOLD,
                "match_count": 3,
                "p_embedding_version": ACTIVE_EMBEDDING_VERSION,
            },
        ).execute()
    except Exception as e:
        logger.error(f"pgvector match query failed: {e}")
        raise HTTPException(status_code=500, detail="Database query failed")

    if not res.data:
        return IdentifyResponse(result="no_match", matches=[])

    matches = [
        MatchCandidate(
            dog_id=row["dog_id"],
            name=row["name"],
            breed=row.get("breed"),
            similarity=round(float(row["similarity"]), 4),
            is_match=float(row["similarity"]) >= MATCH_THRESHOLD,
        )
        for row in res.data
    ]

    # Check if top result meets threshold
    if matches[0].similarity < MATCH_THRESHOLD:
        return IdentifyResponse(result="no_match", matches=[])

    return IdentifyResponse(result="match", matches=matches)
