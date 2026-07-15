from fastapi import APIRouter, UploadFile, File, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
import logging
from slowapi import Limiter
from slowapi.util import get_remote_address

from routers.dogs import validate_image
from services.inference import get_detector

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/validate-nose", tags=["validate"])
limiter = Limiter(key_func=get_remote_address)

class ValidateResponse(BaseModel):
    detected: bool
    confidence: float
    bbox: Optional[List[float]] = None

@router.post("", response_model=ValidateResponse)
@limiter.limit("30/minute")
async def validate_nose_endpoint(
    request: Request,
    image: UploadFile = File(...)
):
    """
    Lightweight nose detection only — no embedding extraction.
    Runs YOLOv8 only.
    """
    try:
        image_bytes = await validate_image(request, image)
        detector = get_detector()
        detections = detector(image_bytes)
        
        if not detections:
            return ValidateResponse(detected=False, confidence=0.0)
            
        # Get highest confidence detection
        best_det = max(detections, key=lambda x: x["confidence"])
        
        return ValidateResponse(
            detected=True,
            confidence=best_det["confidence"],
            bbox=best_det["bbox"]
        )
    except Exception as e:
        logger.error(f"Validation failed: {e}")
        return ValidateResponse(detected=False, confidence=0.0)
