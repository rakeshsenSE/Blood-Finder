"""Database access helpers (CRUD)."""

from datetime import datetime, timezone

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

import models
import schemas


# ---------- Stats ----------
def get_stats(db: Session) -> models.Stats:
    stats = db.get(models.Stats, 1)
    if stats is None:
        stats = models.Stats(
            id=1, donors_count=0, lives_saved_count=0, active_requests_count=0
        )
        db.add(stats)
        db.commit()
        db.refresh(stats)
    return stats


def increment_stats(db: Session, payload: schemas.StatsIncrement) -> models.Stats:
    stats = get_stats(db)
    field = {
        "donors": "donors_count",
        "lives_saved": "lives_saved_count",
        "active_requests": "active_requests_count",
    }[payload.metric]
    setattr(stats, field, getattr(stats, field) + payload.amount)
    db.commit()
    db.refresh(stats)
    return stats


# ---------- Donors ----------
def list_donors(
    db: Session,
    blood_group: str | None = None,
    division: str | None = None,
    district: str | None = None,
    hospital_or_area: str | None = None,
    limit: int = 100,
) -> list[models.Donor]:
    stmt = select(models.Donor)
    if blood_group:
        stmt = stmt.where(models.Donor.blood_group == blood_group)
    if division:
        term = f"%{division.strip()}%"
        stmt = stmt.where(models.Donor.division.ilike(term))
    if district:
        term = f"%{district.strip()}%"
        stmt = stmt.where(models.Donor.district.ilike(term))
    if hospital_or_area:
        term = f"%{hospital_or_area.strip()}%"
        stmt = stmt.where(
            models.Donor.district.ilike(term) | models.Donor.upazila.ilike(term)
        )
    stmt = stmt.order_by(models.Donor.id).limit(limit)
    return list(db.scalars(stmt))


def create_donor(db: Session, payload: schemas.DonorCreate) -> models.Donor:
    donor = models.Donor(**payload.model_dump(), verified=False)
    db.add(donor)
    increment_stats(db, schemas.StatsIncrement(metric="donors", amount=1))
    db.commit()
    db.refresh(donor)
    return donor


# ---------- SOS requests ----------
def humanize(created_at: datetime) -> str:
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - created_at
    minutes = int(delta.total_seconds() // 60)
    if minutes < 1:
        return "Just now"
    if minutes < 60:
        return f"{minutes} min ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours} hour{'s' if hours > 1 else ''} ago"
    days = hours // 24
    return f"{days} day{'s' if days > 1 else ''} ago"


def list_requests(db: Session, limit: int = 50) -> list[schemas.BloodRequestOut]:
    stmt = select(models.BloodRequest).order_by(desc(models.BloodRequest.created_at)).limit(limit)
    rows = list(db.scalars(stmt))
    return [
        schemas.BloodRequestOut.model_validate(row).model_copy(
            update={"posted_at": humanize(row.created_at)}
        )
        for row in rows
    ]


def create_request(db: Session, payload: schemas.BloodRequestCreate) -> schemas.BloodRequestOut:
    req = models.BloodRequest(**payload.model_dump())
    db.add(req)
    increment_stats(db, schemas.StatsIncrement(metric="active_requests", amount=1))
    db.commit()
    db.refresh(req)
    return schemas.BloodRequestOut.model_validate(req).model_copy(
        update={"posted_at": humanize(req.created_at)}
    )


# ---------- Blood banks ----------
def list_blood_banks(db: Session) -> list[models.BloodBank]:
    return list(db.scalars(select(models.BloodBank).order_by(models.BloodBank.id)))
