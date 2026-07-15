from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging
from slowapi import Limiter
from slowapi.util import get_remote_address
from dependencies import get_service_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/report", tags=["report"])
limiter = Limiter(key_func=get_remote_address)

class ReportRequest(BaseModel):
    dog_id: str
    note: Optional[str] = None

class ReportResponse(BaseModel):
    success: bool
    message: str

@router.post("", response_model=ReportResponse)
@limiter.limit("5/minute")
def report_incorrect_match(
    request: Request,
    report: ReportRequest
):
    """
    Stores an incorrect-match report.
    No auth required.
    """
    supabase = get_service_supabase()
    
    try:
        supabase.table("reports").insert({
            "dog_id": report.dog_id,
            "note": report.note
        }).execute()
        return {"success": True, "message": "Report submitted successfully"}
    except Exception as e:
        logger.error(f"Failed to submit report: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit report")
