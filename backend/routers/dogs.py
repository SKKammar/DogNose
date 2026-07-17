import os
import logging
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional

from dependencies import (
    get_service_supabase,
    get_current_user_id,
)
from services.inference import get_embedding, get_nose_detector
from services.validator import (
    run_full_validation,
    ImageValidationError,
    read_upload_as_array,
)

from slowapi import Limiter
from slowapi.util import get_remote_address
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
MATCH_THRESHOLD = float(os.getenv("MATCH_THRESHOLD", "0.60"))
ACTIVE_EMBEDDING_VERSION = "megadescriptor-v1"
IDENTIFY_RATE_LIMIT = os.getenv("IDENTIFY_RATE_LIMIT", "10/minute")


# --- Request/Response models ---

class DogCreate(BaseModel):
    name: str
    breed: Optional[str] = None
    age: Optional[float] = None
    sex: Optional[str] = None
    color_markings: Optional[str] = None
    owner_name: Optional[str] = None
    owner_phone: Optional[str] = None
    owner_email: Optional[str] = None
    microchip_id: Optional[str] = None
    notes: Optional[str] = None
    profile_photo_url: Optional[str] = None


class DogResponse(BaseModel):
    id: str
    name: str
    breed: Optional[str] = None
    age: Optional[float] = None
    sex: Optional[str] = None
    color_markings: Optional[str] = None
    owner_name: Optional[str] = None
    owner_phone: Optional[str] = None
    owner_email: Optional[str] = None
    microchip_id: Optional[str] = None
    notes: Optional[str] = None
    profile_photo_url: Optional[str] = None


class DogListItem(BaseModel):
    id: str
    name: str
    breed: Optional[str] = None
    nose_print_count: int = 0
    profile_photo_url: Optional[str] = None


class MatchCandidate(BaseModel):
    dog_id: str
    name: str
    breed: Optional[str] = None
    age: Optional[float] = None
    sex: Optional[str] = None
    color_markings: Optional[str] = None
    owner_name: Optional[str] = None
    owner_phone: Optional[str] = None
    owner_email: Optional[str] = None
    profile_photo_url: Optional[str] = None
    similarity: float
    is_match: bool


class IdentifyResponse(BaseModel):
    match: bool
    message: str
    confidence: Optional[float] = None
    dog: Optional[MatchCandidate] = None


# --- Image validation helper ---

async def validate_upload_metadata(request: Request, file: UploadFile) -> None:
    """Validate uploaded file metadata: check type and size only."""
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
        "age": dog.age,
        "sex": dog.sex,
        "color_markings": dog.color_markings,
        "owner_name": dog.owner_name,
        "owner_phone": dog.owner_phone,
        "owner_email": dog.owner_email,
        "microchip_id": dog.microchip_id,
        "notes": dog.notes,
        "profile_photo_url": dog.profile_photo_url,
    }

    res = supabase.table("dogs").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create dog")

    row = res.data[0]
    return DogResponse(
        id=row["id"],
        name=row["name"],
        breed=row.get("breed"),
        age=row.get("age"),
        sex=row.get("sex"),
        color_markings=row.get("color_markings"),
        owner_name=row.get("owner_name"),
        owner_phone=row.get("owner_phone"),
        owner_email=row.get("owner_email"),
        microchip_id=row.get("microchip_id"),
        notes=row.get("notes"),
        profile_photo_url=row.get("profile_photo_url"),
    )


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
        .select("id, name, breed, embedding, profile_photo_url")
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
            profile_photo_url=d.get("profile_photo_url"),
        )
        for d in dogs_res.data
    ]


@router.post("/{dog_id}/enroll")
@limiter.limit("10/minute")
async def enroll_dog(
    request: Request,
    dog_id: str,
    nose_images: List[UploadFile] = File(...),
    user_id: str = Depends(get_current_user_id),
):
    """
    Enroll multiple nose photos for a dog. Runs the full validation + embedding
    pipeline on each, averages the valid embeddings, and stores the centroid.
    """
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

    nose_model = get_nose_detector()
    valid_embeddings = []
    errors = []

    for i, nose_image in enumerate(nose_images):
        try:
            # Validate file metadata
            await validate_upload_metadata(request, nose_image)

            # Read into memory as BGR array
            image_bgr = await read_upload_as_array(nose_image)

            # Run full validation pipeline (quality + dog + nose)
            nose_crop = run_full_validation(nose_model, image_bgr)

            # Extract embedding from cropped nose
            embedding = get_embedding(nose_crop)
            valid_embeddings.append(embedding)
        except ImageValidationError as e:
            logger.warning(f"Photo {i+1} for {dog_id} failed validation: [{e.code}] {e.message}")
            errors.append({"photo": i + 1, "code": e.code, "message": e.message})
            continue
        except Exception as e:
            logger.warning(f"Skipping photo {i+1} for {dog_id}: {e}")
            errors.append({"photo": i + 1, "code": "PROCESSING_ERROR", "message": str(e)})
            continue

    if not valid_embeddings:
        return JSONResponse(
            status_code=422,
            content={
                "error": True,
                "code": "NO_VALID_PHOTOS",
                "message": "No valid nose prints detected in any of the uploaded photos.",
                "photo_errors": errors,
            }
        )

    # Calculate centroid embedding
    embeddings_matrix = np.vstack(valid_embeddings)
    avg_embedding = np.mean(embeddings_matrix, axis=0)

    # L2 normalize
    norm = np.linalg.norm(avg_embedding)
    if norm > 0:
        avg_embedding = avg_embedding / norm

    data = {
        "embedding": avg_embedding.tolist(),
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

    return {
        "nose_print_id": dog_id,
        "photos_processed": len(valid_embeddings),
        "photos_failed": len(errors),
        "photo_errors": errors if errors else None,
    }


@router.get("/{dog_id}", response_model=DogResponse)
def get_dog(dog_id: str, user_id: str = Depends(get_current_user_id)):
    """Get full dog profile."""
    supabase = get_service_supabase()
    res = supabase.table("dogs").select("*").eq("id", dog_id).eq("owner", user_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Dog not found")
    row = res.data[0]
    return DogResponse(**row)


@router.delete("/{dog_id}")
def delete_dog(dog_id: str, user_id: str = Depends(get_current_user_id)):
    """Delete a dog."""
    supabase = get_service_supabase()
    # verify ownership
    check = supabase.table("dogs").select("id").eq("id", dog_id).eq("owner", user_id).execute()
    if not check.data:
        raise HTTPException(status_code=403, detail="Not authorized")
    # Due to ON DELETE CASCADE on potential FKs, this might be simpler.
    # Note: supabase storage deletion is omitted for simplicity in this endpoint,
    # could be added via supabase storage API if required.
    res = supabase.table("dogs").delete().eq("id", dog_id).execute()
    return {"deleted": True}


@router.get("/user/scan-logs")
def get_scan_logs(user_id: str = Depends(get_current_user_id)):
    """Return scan events for the authenticated user's dogs."""
    supabase = get_service_supabase()
    res = supabase.rpc("get_user_scan_logs", {"p_owner_id": user_id}).execute()

    # Alternative direct approach using inner join if RPC not defined:
    # res = supabase.table("scan_logs").select("*, dogs!inner(name, owner)").eq("dogs.owner", user_id).order("scanned_at", desc=True).limit(50).execute()

    if res.data is None:
        # fallback if rpc is not created
        dogs_res = supabase.table("dogs").select("id, name").eq("owner", user_id).execute()
        if not dogs_res.data:
            return []
        dog_ids = [d["id"] for d in dogs_res.data]
        dog_names = {d["id"]: d["name"] for d in dogs_res.data}
        if not dog_ids:
            return []
        logs_res = supabase.table("scan_logs").select("*").in_("matched_dog_id", dog_ids).order("scanned_at", desc=True).limit(50).execute()
        if not logs_res.data:
            return []

        result = []
        for l in logs_res.data:
            result.append({
                "dog_name": dog_names.get(l["matched_dog_id"], "Unknown"),
                "similarity_score": l["similarity_score"],
                "scanned_at": l["scanned_at"]
            })
        return result
    return res.data


@router.post("/identify")
@limiter.limit(IDENTIFY_RATE_LIMIT)
async def identify_dog(
    request: Request,
    nose_image: UploadFile = File(...),
):
    """
    Identify a dog from a nose photo. No auth required.
    Runs full validation pipeline, then queries pgvector for top-3 matches.
    """
    # Validate file metadata (type + size)
    await validate_upload_metadata(request, nose_image)

    # Read into memory as BGR array
    image_bgr = await read_upload_as_array(nose_image)

    # Run full validation pipeline (quality → dog detection → nose detection)
    # ImageValidationError is caught by the global exception handler in main.py
    nose_model = get_nose_detector()
    nose_crop = run_full_validation(nose_model, image_bgr)

    # Extract embedding from cropped nose
    embedding = get_embedding(nose_crop)

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

    if not res.data or len(res.data) == 0:
        return JSONResponse(
            status_code=200,
            content={
                "match": False,
                "matched": False,
                "code": "NO_MATCH",
                "message": (
                    "This dog is not in the database yet. "
                    "Please enroll them first using the Enroll option."
                ),
                "confidence": 0.0,
            }
        )

    matches = [
        MatchCandidate(
            dog_id=row["dog_id"],
            name=row["name"],
            breed=row.get("breed"),
            age=row.get("age"),
            sex=row.get("sex"),
            color_markings=row.get("color_markings"),
            owner_name=row.get("owner_name"),
            owner_phone=row.get("owner_phone"),
            owner_email=row.get("owner_email"),
            profile_photo_url=row.get("profile_photo_url"),
            similarity=round(float(row["similarity"]), 4),
            is_match=float(row["similarity"]) >= MATCH_THRESHOLD,
        )
        for row in res.data
    ]

    # Check if top result meets threshold
    if matches[0].similarity < MATCH_THRESHOLD:
        return JSONResponse(
            status_code=200,
            content={
                "match": False,
                "matched": False,
                "code": "NO_MATCH",
                "message": (
                    "This dog is not in the database yet. "
                    "Please enroll them first using the Enroll option."
                ),
                "confidence": matches[0].similarity,
            }
        )

    # Log successful match
    try:
        client_ip = request.client.host if request.client else "unknown"
        import hashlib
        ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()
        supabase.table("scan_logs").insert({
            "matched_dog_id": matches[0].dog_id,
            "similarity_score": matches[0].similarity,
            "scanner_ip_hash": ip_hash
        }).execute()
    except Exception as e:
        logger.error(f"Failed to log scan: {e}")

    return {
        "match": True,
        "matched": True,
        "message": "Match found",
        "confidence": matches[0].similarity,
        "confidence_pct": f"{matches[0].similarity * 100:.1f}%",
        "dog": matches[0].dict(),
    }
