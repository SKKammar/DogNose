import os
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional
from supabase import Client
from backend.dependencies import get_supabase, get_anon_supabase, security
from backend.services.inference import extract_embedding
from slowapi import Limiter
from slowapi.util import get_remote_address
import cv2
import numpy as np
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dogs", tags=["dogs"])
limiter = Limiter(key_func=get_remote_address)

# Configuration from environment
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "8"))
MAX_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
ALLOWED_UPLOAD_TYPES = os.getenv("ALLOWED_UPLOAD_TYPES", "image/jpeg,image/png,image/webp").split(",")
MATCH_THRESHOLD = float(os.getenv("MATCH_THRESHOLD", "0.65"))
ACTIVE_EMBEDDING_VERSION = os.getenv("ACTIVE_EMBEDDING_VERSION", "v1")
IDENTIFY_RATE_LIMIT = os.getenv("IDENTIFY_RATE_LIMIT", "10/minute")

class DogCreate(BaseModel):
    name: str
    breed: Optional[str] = None

class DogResponse(BaseModel):
    id: str
    name: str
    breed: Optional[str]
    created_at: str
    is_lost: bool = False
    lost_since: Optional[str] = None

class IdentifyNoMatch(BaseModel):
    status: str = "no_match"

class Candidate(BaseModel):
    dog_id: str
    name: str
    breed: Optional[str]
    confidence: float

class LostStatusUpdate(BaseModel):
    is_lost: bool

class IdentifyMatch(BaseModel):
    status: str = "match"
    confidence: float
    candidates: List[Candidate]

async def validate_image(request: Request, file: UploadFile):
    if file.content_type not in ALLOWED_UPLOAD_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_UPLOAD_TYPES)}")
    
    content_length = request.headers.get('content-length')
    if content_length and int(content_length) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum size is {MAX_FILE_SIZE_MB}MB.")
    
    content = await file.read()
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum size is {MAX_FILE_SIZE_MB}MB.")
    
    nparr = np.frombuffer(content, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image file or format")
        
    success, buffer = cv2.imencode('.jpg', img)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to process image")
        
    return buffer.tobytes()

from fastapi.security import HTTPAuthorizationCredentials
from fastapi import Security

@router.post("", response_model=DogResponse)
def register_dog(
    dog: DogCreate, 
    supabase: Client = Depends(get_supabase),
    credentials: HTTPAuthorizationCredentials = Security(security)
):
    user_res = supabase.auth.get_user(credentials.credentials)
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
@limiter.limit("10/minute")
async def enroll_dog(request: Request, dog_id: str, file: UploadFile = File(...), supabase: Client = Depends(get_supabase)):
    image_bytes = await validate_image(request, file)
    
    try:
        embedding = extract_embedding(image_bytes, ACTIVE_EMBEDDING_VERSION)
    except ValueError as e:
        msg = str(e)
        if "NO_NOSE" in msg or "MULTIPLE_NOSES" in msg:
            raise HTTPException(status_code=400, detail=msg.split(": ", 1)[-1])
        raise HTTPException(status_code=400, detail=msg)
    
    data = {
        "dog_id": dog_id,
        "embedding": embedding.tolist(),
        "embedding_version": ACTIVE_EMBEDDING_VERSION
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
async def identify_dog(request: Request, file: UploadFile = File(...), supabase: Client = Depends(get_anon_supabase)):
    image_bytes = await validate_image(request, file)
    
    try:
        embedding = extract_embedding(image_bytes, ACTIVE_EMBEDDING_VERSION)
    except ValueError as e:
        msg = str(e)
        if "NO_NOSE" in msg or "MULTIPLE_NOSES" in msg:
            raise HTTPException(status_code=400, detail=msg.split(": ", 1)[-1])
        raise HTTPException(status_code=400, detail=msg)
    
    res = supabase.rpc("match_lost_dogs", {
        "query_embedding": embedding.tolist(),
        "match_threshold": MATCH_THRESHOLD,
        "match_count": 3,
        "p_embedding_version": ACTIVE_EMBEDDING_VERSION
    }).execute()
    
    if not res.data:
        return IdentifyNoMatch()
    
    return IdentifyMatch(
        confidence=res.data[0]["confidence"],
        candidates=[Candidate(dog_id=c["dog_id"], name=c["name"], breed=c["breed"], confidence=c["confidence"]) for c in res.data]
    )

@router.patch("/{dog_id}/lost-status")
@limiter.limit("10/minute")
async def update_lost_status(request: Request, dog_id: str, status: LostStatusUpdate, supabase: Client = Depends(get_supabase)):
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat() if status.is_lost else None
    
    data = {"is_lost": status.is_lost, "lost_since": now}
    res = supabase.table("dogs").update(data).eq("id", dog_id).execute()
    
    if not res.data:
        raise HTTPException(status_code=404, detail="Dog not found or unauthorized")
        
    return res.data[0]

@router.post("/{dog_id}/notify-owner")
@limiter.limit("5/minute")
async def notify_owner(request: Request, dog_id: str, supabase: Client = Depends(get_anon_supabase)):
    logger.info(f"Notification triggered for dog {dog_id} (mocked)")
    return {"status": "success", "message": "Owner has been notified."}
