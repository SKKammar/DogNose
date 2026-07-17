from fastapi import APIRouter, UploadFile, File, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
import logging
from slowapi import Limiter
from slowapi.util import get_remote_address

from services.inference import get_nose_detector
from services.validator import (
    run_full_validation,
    ImageValidationError,
    read_upload_as_array,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/validate-nose", tags=["validate"])
limiter = Limiter(key_func=get_remote_address)

class ValidateResponse(BaseModel):
    valid: bool
    message: str
    code: Optional[str] = None

@router.post("", response_model=ValidateResponse)
@limiter.limit("30/minute")
async def validate_nose_endpoint(
    request: Request,
    image: UploadFile = File(...)
):
    """
    Lightweight validation-only endpoint — runs the full two-stage pipeline
    (dog detection + nose detection) but does NOT extract an embedding.
    Use this for real-time camera preview feedback.
    """
    try:
        image_bgr = await read_upload_as_array(image)
        nose_model = get_nose_detector()
        run_full_validation(nose_model, image_bgr)

        return ValidateResponse(
            valid=True,
            message="Dog nose detected and ready for identification.",
            code="OK",
        )
    except ImageValidationError as e:
        return ValidateResponse(
            valid=False,
            message=e.message,
            code=e.code,
        )
    except Exception as e:
        logger.error(f"Validation failed: {e}")
        return ValidateResponse(
            valid=False,
            message="Validation failed due to an internal error.",
            code="INTERNAL_ERROR",
        )
