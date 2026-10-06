"""SQLAlchemy ORM models for BloodFinder."""

from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Donor(Base):
    __tablename__ = "donors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    blood_group: Mapped[str] = mapped_column(String(3), index=True, nullable=False)
    division: Mapped[str] = mapped_column(String(60), index=True, nullable=False)
    district: Mapped[str] = mapped_column(String(60), index=True, nullable=False)
    upazila: Mapped[str] = mapped_column(String(60), default="")
    last_donation_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    phone: Mapped[str] = mapped_column(String(30), nullable=False)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)


class BloodRequest(Base):
    """Emergency SOS blood request."""

    __tablename__ = "blood_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    patient_name: Mapped[str] = mapped_column(String(120), nullable=False)
    hospital_name: Mapped[str] = mapped_column(String(160), nullable=False)
    location: Mapped[str | None] = mapped_column(String(160), nullable=True, default="")
    blood_group: Mapped[str] = mapped_column(String(3), index=True, nullable=False)
    bags_needed: Mapped[int] = mapped_column(Integer, default=1)
    urgency: Mapped[str] = mapped_column(String(40), default="Immediate")
    contact_number: Mapped[str] = mapped_column(String(30), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


class BloodBank(Base):
    __tablename__ = "blood_banks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    location: Mapped[str] = mapped_column(String(240), nullable=False)
    phone: Mapped[str] = mapped_column(String(40), nullable=False)
    services: Mapped[str] = mapped_column(String(240), default="")
    operating_hours: Mapped[str] = mapped_column(String(80), default="Open 24/7")


class ContactLog(Base):
    """Audit log — records every time a logged-in user reveals a donor's contact."""

    __tablename__ = "contact_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    viewer_email: Mapped[str] = mapped_column(String(254), nullable=False, index=True)
    donor_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


class Stats(Base):
    """Single-row table holding live platform counters."""

    __tablename__ = "stats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    donors_count: Mapped[int] = mapped_column(Integer, default=0)
    lives_saved_count: Mapped[int] = mapped_column(Integer, default=0)
    active_requests_count: Mapped[int] = mapped_column(Integer, default=0)
