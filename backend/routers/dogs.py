import logging
import os

import numpy as np
from dependencies import (
    get_current_user_id,
    get_service_supabase,
)
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from services.inference import get_embedding, get_nose_detector
from services.validator import (
    ImageValidationError,
    read_upload_as_array,
    run_full_validation,
)
from main import limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dogs", tags=["dogs"])

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
    breed: str | None = None
    age: float | None = None
    sex: str | None = None
    color_markings: str | None = None
    owner_name: str | None = None
    owner_phone: str | None = None
    owner_email: str | None = None
    microchip_id: str | None = None
    notes: str | None = None
    profile_photo_url: str | None = None


class DogUpdate(BaseModel):
    name: str | None = None
    breed: str | None = None
    age: float | None = None
    sex: str | None = None
    color_markings: str | None = None
    owner_name: str | None = None
    owner_phone: str | None = None
    owner_email: str | None = None
    microchip_id: str | None = None
    notes: str | None = None
    profile_photo_url: str | None = None


class DogResponse(BaseModel):
    id: str
    name: str
    breed: str | None = None
    age: float | None = None
    sex: str | None = None
    color_markings: str | None = None
    owner_name: str | None = None
    owner_phone: str | None = None
    owner_email: str | None = None
    microchip_id: str | None = None
    notes: str | None = None
    profile_photo_url: str | None = None


class DogListItem(BaseModel):
    id: str
    name: str
    breed: str | None = None
    nose_print_count: int = 0
    profile_photo_url: str | None = None


class MatchCandidate(BaseModel):
    dog_id: str
    name: str
    breed: str | None = None
    age: float | None = None
    sex: str | None = None
    color_markings: str | None = None
    owner_name: str | None = None
    owner_phone: str | None = None
    owner_email: str | None = None
    profile_photo_url: str | None = None
    similarity: float
    is_match: bool


class IdentifyResponse(BaseModel):
    match: bool
    message: str
    confidence: float | None = None
    dog: MatchCandidate | None = None


# --- Image validation helper ---

def validate_upload_metadata(request: Request, file: UploadFile) -> None:
    """Validate uploaded file metadata: check type and size only."""
    if file.content_type not in ALLOWED_UPLOAD_TYPES:
        raise HTTPException(
            status_code=422,
            detail={"code": "VALIDATION_ERROR", "message": f"Invalid file type. Allowed: {', '.join(ALLOWED_UPLOAD_TYPES)}"},
        )

    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=422,
            detail={"code": "VALIDATION_ERROR", "message": f"File too large. Maximum size is {MAX_FILE_SIZE_MB}MB."},
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
        raise HTTPException(status_code=500, detail={"code": "CREATE_FAILED", "message": "Failed to create dog"})

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


@router.get("", response_model=list[DogListItem])
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
def enroll_dog(
    request: Request,
    dog_id: str,
    nose_images: list[UploadFile] = File(...),
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
            status_code=403, detail={"code": "UNAUTHORIZED", "message": "You do not have permission to access this resource."}
        )

    nose_model = get_nose_detector()
    valid_embeddings = []
    errors = []
    profile_photo_url = None

    for i, nose_image in enumerate(nose_images):
        try:
            # Validate file metadata
            validate_upload_metadata(request, nose_image)

            # Read into memory as BGR array
            image_bgr = read_upload_as_array(nose_image)

            # Run full validation pipeline (quality + dog + nose)
            nose_crop = run_full_validation(nose_model, image_bgr)

            # Extract embedding from cropped nose
            embedding = get_embedding(nose_crop)
            valid_embeddings.append(embedding)

            # Save the first valid photo as the profile photo
            if profile_photo_url is None:
                import os

                import cv2
                upload_dir = "static/uploads"
                os.makedirs(upload_dir, exist_ok=True)
                file_path = os.path.join(upload_dir, f"{dog_id}.jpg")
                cv2.imwrite(file_path, image_bgr)
                profile_photo_url = f"{request.base_url.scheme}://{request.base_url.netloc}/static/uploads/{dog_id}.jpg"
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
    if profile_photo_url:
        data["profile_photo_url"] = profile_photo_url

    try:
        res = supabase.table("dogs").update(data).eq("id", dog_id).execute()
    except Exception as e:
        logger.error(f"Failed to update dog embedding: {e}")
        raise HTTPException(
            status_code=500, detail={"code": "EMBEDDING_FAILED", "message": "Could not generate embedding. Check image quality."}
        )

    if not res.data:
        raise HTTPException(status_code=500, detail={"code": "ENROLL_FAILED", "message": "Failed to enroll dog"})

    return {
        "nose_print_id": dog_id,
        "photos_processed": len(valid_embeddings),
        "photos_failed": len(errors),
        "photo_errors": errors if errors else None,
    }


@router.get("/user/scan-logs")
def get_scan_logs(user_id: str = Depends(get_current_user_id)):
    """Return scan events for the authenticated user's dogs."""
    supabase = get_service_supabase()
    dogs_res = supabase.table("dogs").select("id, name").eq("owner", user_id).execute()
    if not dogs_res.data:
        return []
    dog_ids = [d["id"] for d in dogs_res.data]
    dog_names = {d["id"]: d["name"] for d in dogs_res.data}
    if not dog_ids:
        return []
    logs_res = (
        supabase.table("scan_logs")
        .select("*")
        .in_("matched_dog_id", dog_ids)
        .order("scanned_at", desc=True)
        .limit(50)
        .execute()
    )
    if not logs_res.data:
        return []
    return [
        {
            "id": l["id"],
            "dog_name": dog_names.get(l["matched_dog_id"], "Unknown"),
            "match_confidence": l.get("similarity_score"),
            "scanned_at": l["scanned_at"],
            "location_lat": l.get("location_lat"),
            "location_lon": l.get("location_lon"),
        }
        for l in logs_res.data
    ]


@router.get("/{dog_id}", response_model=DogResponse)
def get_dog(dog_id: str, user_id: str = Depends(get_current_user_id)):
    """Get full dog profile."""
    supabase = get_service_supabase()
    res = supabase.table("dogs").select("*").eq("id", dog_id).eq("owner", user_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail={"code": "DOG_NOT_FOUND", "message": "No dog found with that ID."})
    row = res.data[0]
    return DogResponse(**row)


@router.delete("/{dog_id}")
def delete_dog(dog_id: str, user_id: str = Depends(get_current_user_id)):
    """Delete a dog."""
    supabase = get_service_supabase()
    # verify ownership
    check = supabase.table("dogs").select("id").eq("id", dog_id).eq("owner", user_id).execute()
    if not check.data:
        raise HTTPException(status_code=403, detail={"code": "UNAUTHORIZED", "message": "You do not have permission to access this resource."})
    # Due to ON DELETE CASCADE on potential FKs, this might be simpler.
    # Note: supabase storage deletion is omitted for simplicity in this endpoint,
    # could be added via supabase storage API if required.
    res = supabase.table("dogs").delete().eq("id", dog_id).execute()
    return {"deleted": True}


@router.put("/{dog_id}", response_model=DogResponse)
def update_dog(
    dog_id: str,
    dog: DogUpdate,
    user_id: str = Depends(get_current_user_id)
):
    """Update a dog's profile."""
    supabase = get_service_supabase()
    # verify ownership
    check = supabase.table("dogs").select("id").eq("id", dog_id).eq("owner", user_id).execute()
    if not check.data:
        raise HTTPException(status_code=403, detail={"code": "UNAUTHORIZED", "message": "You do not have permission to access this resource."})
    
    # Filter out None values to only update provided fields
    update_data = {k: v for k, v in dog.model_dump().items() if v is not None}
    
    if not update_data:
        return get_dog(dog_id, user_id)
        
    res = supabase.table("dogs").update(update_data).eq("id", dog_id).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail={"code": "UPDATE_FAILED", "message": "Failed to update dog"})
        
    row = res.data[0]
    return DogResponse(**row)


@router.post("/identify", response_model=IdentifyResponse)
@limiter.limit(IDENTIFY_RATE_LIMIT)
def identify_dog(
    request: Request,
    nose_image: UploadFile = File(...),
):
    """
    Identify a dog from a nose photo. No auth required.
    Runs full validation pipeline, then queries pgvector for top-3 matches.
    """
    # Validate file metadata (type + size)
    validate_upload_metadata(request, nose_image)

    # Read into memory as BGR array
    image_bgr = read_upload_as_array(nose_image)

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
        raise HTTPException(status_code=500, detail={"code": "DB_ERROR", "message": "Database query failed"})

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
