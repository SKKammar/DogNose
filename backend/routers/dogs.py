import os
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional
from supabase import Client
from backend.dependencies import get_supabase
from backend.services.inference import extract_embedding, match_embedding
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter(prefix="/dogs", tags=["dogs"])
limiter = Limiter(key_func=get_remote_address)

# Configuration from environment
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "8"))
MAX_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
ALLOWED_UPLOAD_TYPES = os.getenv("ALLOWED_UPLOAD_TYPES", "image/jpeg,image/png,image/webp").split(",")
MATCH_THRESHOLD = float(os.getenv("MATCH_THRESHOLD", "0.65"))
EMBEDDING_VERSION = os.getenv("EMBEDDING_VERSION", "v1")
IDENTIFY_RATE_LIMIT = os.getenv("IDENTIFY_RATE_LIMIT", "10/minute")

class DogCreate(BaseModel):
    name: str
    breed: Optional[str] = None

class DogResponse(BaseModel):
    id: str
    name: str
    breed: Optional[str]
    created_at: str

class IdentifyNoMatch(BaseModel):
    status: str = "no_match"

class Candidate(BaseModel):
    dog_id: str
    confidence: float

class IdentifyMatch(BaseModel):
    status: str = "match"
    confidence: float
    candidates: List[Candidate]

def validate_image(file: UploadFile):
    if file.content_type not in ALLOWED_UPLOAD_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_UPLOAD_TYPES)}")
    
    content = file.file.read()
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum size is {MAX_FILE_SIZE_MB}MB.")
    
    file.file.seek(0)
    return content

@router.post("", response_model=DogResponse)
def register_dog(dog: DogCreate, supabase: Client = Depends(get_supabase)):
    user_res = supabase.auth.get_user()
    if not user_res or not user_res.user:
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    data = {
        "owner_id": user_res.user.id,
        "name": dog.name,
        "breed": dog.breed
    }
    
    res = supabase.table("dogs").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create dog")
    return res.data[0]

@router.get("", response_model=List[DogResponse])
def list_dogs(supabase: Client = Depends(get_supabase)):
    res = supabase.table("dogs").select("*").execute()
    return res.data

@router.post("/{dog_id}/enroll")
def enroll_dog(dog_id: str, file: UploadFile = File(...), supabase: Client = Depends(get_supabase)):
    image_bytes = validate_image(file)
    
    try:
        embedding = extract_embedding(image_bytes)
    except ValueError as e:
        msg = str(e)
        if "NO_NOSE" in msg or "MULTIPLE_NOSES" in msg:
            raise HTTPException(status_code=400, detail=msg.split(": ", 1)[-1])
        raise HTTPException(status_code=400, detail=msg)
    
    data = {
        "dog_id": dog_id,
        "embedding": embedding.tolist(),
        "embedding_version": EMBEDDING_VERSION
    }
    
    try:
        res = supabase.table("nose_prints").insert(data).execute()
    except Exception:
        raise HTTPException(status_code=403, detail="Not allowed to enroll for this dog or dog does not exist")
        
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to enroll dog")
        
    return {"status": "success", "nose_print_id": res.data[0]["id"]}

@router.post("/identify")
@limiter.limit(IDENTIFY_RATE_LIMIT)
def identify_dog(request: Request, file: UploadFile = File(...), supabase: Client = Depends(get_supabase)):
    image_bytes = validate_image(file)
    
    try:
        embedding = extract_embedding(image_bytes)
    except ValueError as e:
        msg = str(e)
        if "NO_NOSE" in msg or "MULTIPLE_NOSES" in msg:
            raise HTTPException(status_code=400, detail=msg.split(": ", 1)[-1])
        raise HTTPException(status_code=400, detail=msg)
    
    match_result = match_embedding(supabase, embedding)
    
    if not match_result or match_result["confidence"] < MATCH_THRESHOLD:
        return IdentifyNoMatch()
    
    return IdentifyMatch(
        confidence=match_result["confidence"],
        candidates=match_result["candidates"]
    )
