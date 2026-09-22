import logging
from datetime import date
from typing import Optional, Literal

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, ValidationError

from dependencies import get_current_user_id, get_service_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dogs/{dog_id}/health", tags=["health"])


# ---------- Pydantic bodies ----------

class AllergyBody(BaseModel):
    allergen: str
    severity: Optional[Literal["mild", "moderate", "severe"]] = None
    notes: Optional[str] = None

class VaccinationBody(BaseModel):
    vaccine_name: str
    date_given: Optional[date] = None
    next_due: Optional[date] = None
    notes: Optional[str] = None

class MedicationBody(BaseModel):
    name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    notes: Optional[str] = None

class MedicalVisitBody(BaseModel):
    visit_date: Optional[date] = None
    reason: Optional[str] = None
    vet_name: Optional[str] = None
    diagnosis: Optional[str] = None
    notes: Optional[str] = None

class WeightLogBody(BaseModel):
    weight_kg: float
    measured_at: date
    notes: Optional[str] = None


# ---------- Type registry ----------

RECORD_TYPES = {
    "allergies":    ("allergies",      AllergyBody,      "created_at"),
    "vaccinations": ("vaccinations",   VaccinationBody,  "date_given"),
    "medications":  ("medications",    MedicationBody,   "created_at"),
    "visits":       ("medical_visits", MedicalVisitBody, "visit_date"),
    "weights":      ("weight_logs",    WeightLogBody,    "measured_at"),
}


def _resolve(record_type: str):
    if record_type not in RECORD_TYPES:
        raise HTTPException(404, detail={
            "code": "UNKNOWN_TYPE",
            "message": f"Unknown record type: {record_type}",
        })
    return RECORD_TYPES[record_type]


def _verify_owner(dog_id: str, user_id: str) -> None:
    supabase = get_service_supabase()
    res = (
        supabase.table("dogs")
        .select("id")
        .eq("id", dog_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(403, detail={
            "code": "UNAUTHORIZED",
            "message": "You do not have permission to access this resource.",
        })


def _serialize(payload: dict) -> dict:
    return {k: (v.isoformat() if isinstance(v, date) else v) for k, v in payload.items() if v is not None}


# ---------- Summary ----------

@router.get("")
def health_summary(dog_id: str, user_id: str = Depends(get_current_user_id)):
    _verify_owner(dog_id, user_id)
    supabase = get_service_supabase()

    allergies = supabase.table("allergies").select("id, allergen, severity").eq("dog_id", dog_id).execute()
    vaccinations = supabase.table("vaccinations").select("id, vaccine_name, next_due").eq("dog_id", dog_id).execute()
    weights = (
        supabase.table("weight_logs")
        .select("weight_kg, measured_at")
        .eq("dog_id", dog_id)
        .order("measured_at", desc=True)
        .limit(1)
        .execute()
    )

    return {
        "allergies": allergies.data or [],
        "vaccinations": vaccinations.data or [],
        "last_weight_kg": weights.data[0]["weight_kg"] if weights.data else None,
        "last_weight_date": weights.data[0]["measured_at"] if weights.data else None,
    }


# ---------- List ----------

@router.get("/{record_type}")
def list_records(dog_id: str, record_type: str, user_id: str = Depends(get_current_user_id)):
    table, _model, order_col = _resolve(record_type)
    _verify_owner(dog_id, user_id)
    supabase = get_service_supabase()
    res = (
        supabase.table(table)
        .select("*")
        .eq("dog_id", dog_id)
        .order(order_col, desc=True)
        .execute()
    )
    return res.data or []


# ---------- Create ----------

@router.post("/{record_type}", status_code=201)
def create_record(
    dog_id: str,
    record_type: str,
    body: dict = Body(...),
    user_id: str = Depends(get_current_user_id),
):
    table, Model, _order = _resolve(record_type)
    try:
        validated = Model(**body)
    except ValidationError as e:
        raise HTTPException(422, detail={"code": "VALIDATION_ERROR", "message": e.errors()})
    _verify_owner(dog_id, user_id)
    payload = _serialize(validated.model_dump())
    payload["dog_id"] = dog_id
    supabase = get_service_supabase()
    res = supabase.table(table).insert(payload).execute()
    if not res.data:
        raise HTTPException(500, detail={"code": "CREATE_FAILED", "message": "Failed to create record."})
    return res.data[0]


# ---------- Update ----------

@router.put("/{record_type}/{record_id}")
def update_record(
    dog_id: str,
    record_type: str,
    record_id: str,
    body: dict = Body(...),
    user_id: str = Depends(get_current_user_id),
):
    table, Model, _order = _resolve(record_type)
    try:
        validated = Model(**body)
    except ValidationError as e:
        raise HTTPException(422, detail={"code": "VALIDATION_ERROR", "message": e.errors()})
    _verify_owner(dog_id, user_id)
    supabase = get_service_supabase()
    check = (
        supabase.table(table)
        .select("id")
        .eq("id", record_id)
        .eq("dog_id", dog_id)
        .execute()
    )
    if not check.data:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Record not found."})
    payload = _serialize(validated.model_dump())
    res = supabase.table(table).update(payload).eq("id", record_id).execute()
    if not res.data:
        raise HTTPException(500, detail={"code": "UPDATE_FAILED", "message": "Failed to update record."})
    return res.data[0]


# ---------- Delete ----------

@router.delete("/{record_type}/{record_id}")
def delete_record(
    dog_id: str,
    record_type: str,
    record_id: str,
    user_id: str = Depends(get_current_user_id),
):
    table, _model, _order = _resolve(record_type)
    _verify_owner(dog_id, user_id)
    supabase = get_service_supabase()
    check = (
        supabase.table(table)
        .select("id")
        .eq("id", record_id)
        .eq("dog_id", dog_id)
        .execute()
    )
    if not check.data:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Record not found."})
    supabase.table(table).delete().eq("id", record_id).execute()
    return {"deleted": True}
