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
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "10"))
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
    match: bool
    message: str
    confidence: Optional[float] = None
    dog: Optional[MatchCandidate] = None


# --- Image validation helper ---

async def validate_image(request: Request, file: UploadFile) -> bytes:
    """Validate uploaded image: check type, size, and decodability."""
    if file.content_type not in ALLOWED_UPLOAD_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_UPLOAD_TYPES)}",
        )

    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=422,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE_MB}MB.",
        )

    content = await file.read()
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=422,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE_MB}MB.",
        )

    # Verify the image is decodable
    nparr = np.frombuffer(content, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=422, detail="Invalid image file or format")

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
        "owner": user_id,
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

    dogs_res = (
        supabase.table("dogs")
        .select("id, name, breed, embedding")
        .eq("owner", user_id)
        .execute()
    )

    if not dogs_res.data:
        return []

    return [
        DogListItem(
            id=d["id"],
            name=d["name"],
            breed=d.get("breed"),
            nose_print_count=1 if d.get("embedding") else 0,
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
        .eq("owner", user_id)
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

    data = {
        "embedding": embedding.tolist(),
        "embedding_version": ACTIVE_EMBEDDING_VERSION,
    }

    try:
        res = supabase.table("dogs").update(data).eq("id", dog_id).execute()
    except Exception as e:
        logger.error(f"Failed to update dog embedding: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to store nose print embedding"
        )

    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to enroll dog")

    return {"nose_print_id": dog_id}


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
        return {"match": False, "message": "No matching dog found", "confidence": 0.0}

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
        return {"match": False, "message": "No matching dog found", "confidence": matches[0].similarity}

    return {"match": True, "message": "Match found", "confidence": matches[0].similarity, "dog": matches[0].dict()}
