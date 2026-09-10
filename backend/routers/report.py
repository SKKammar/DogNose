import logging

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from main import limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/report", tags=["report"])

class ReportRequest(BaseModel):
    dog_id: str
    note: str | None = None

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
    Logs an incorrect-match report.
    No auth required.
    """
    try:
        logger.warning(f"Incorrect match report received — dog_id: {report.dog_id}, note: {report.note}")
        return {"success": True, "message": "Report submitted successfully"}
    except Exception as e:
        logger.error(f"Failed to submit report: {e}")
        raise HTTPException(status_code=500, detail={"code": "REPORT_FAILED", "message": "Failed to submit report"})
