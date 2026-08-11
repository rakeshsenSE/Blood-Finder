"""Pydantic schemas (request/response contracts)."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

BloodGroup = Literal["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]


# ---------- Donor ----------
class DonorBase(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    blood_group: BloodGroup
    division: str
    district: str
    upazila: str = ""
    last_donation_date: date | None = None
    phone: str = Field(min_length=6, max_length=30)


class DonorCreate(DonorBase):
    pass


class DonorOut(DonorBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    verified: bool = False


# ---------- Blood request (SOS) ----------
class BloodRequestBase(BaseModel):
    patient_name: str = Field(min_length=2, max_length=120)
    hospital_name: str = Field(min_length=2, max_length=160)
    blood_group: BloodGroup
    bags_needed: int = Field(ge=1, le=20, default=1)
    urgency: Literal["Immediate", "Within 12 Hours", "Within 24 Hours"]
    contact_number: str = Field(min_length=6, max_length=30)
    notes: str | None = None


class BloodRequestCreate(BloodRequestBase):
    pass


class BloodRequestOut(BloodRequestBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    posted_at: str = "Just now"  # human friendly, filled in crud


# ---------- Blood bank ----------
class BloodBankOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    location: str
    phone: str
    services: str
    operating_hours: str


# ---------- Stats ----------
class StatsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    donors_count: int
    lives_saved_count: int
    active_requests_count: int


class StatsIncrement(BaseModel):
    metric: Literal["donors", "lives_saved", "active_requests"]
    amount: int = Field(default=1, ge=1, le=1000)


# ---------- Contact Log ----------
class ContactLogCreate(BaseModel):
    viewer_email: EmailStr
    donor_id: int


class ContactLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    viewer_email: str
    donor_id: int
    created_at: datetime
