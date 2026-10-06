"""Database access helpers (CRUD)."""

import math
from datetime import datetime, timezone

from sqlalchemy import desc, func, or_, select
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


def get_active_requests_count(db: Session) -> dict[str, int]:
    """Return count of total active blood requests."""
    stmt = select(func.count()).select_from(models.BloodRequest)
    if hasattr(models.BloodRequest, "status"):
        stmt = stmt.where(models.BloodRequest.status == "active")
    elif hasattr(models.BloodRequest, "is_fulfilled"):
        stmt = stmt.where(models.BloodRequest.is_fulfilled == False)
    count = db.scalar(stmt) or 0
    return {"active_requests_count": count}



# ---------- Donors ----------
def list_donors(
    db: Session,
    blood_group: str | None = None,
    division: str | None = None,
    district: str | None = None,
    hospital_or_area: str | None = None,
    page: int = 1,
    limit: int = 6,
) -> dict:
    """Return a page of donors plus pagination metadata."""
    stmt = select(models.Donor)
    if blood_group:
        stmt = stmt.where(models.Donor.blood_group == blood_group)
    if division:
        term = f"%{division.strip()}%"
        stmt = stmt.where(models.Donor.division.ilike(term))
    if district:
        # TASK 2 FIX: match district OR upazila with case-insensitive search
        term = f"%{district.strip()}%"
        stmt = stmt.where(
            or_(
                models.Donor.district.ilike(term),
                models.Donor.upazila.ilike(term),
            )
        )
    if hospital_or_area:
        term = f"%{hospital_or_area.strip()}%"
        stmt = stmt.where(
            or_(
                models.Donor.district.ilike(term),
                models.Donor.upazila.ilike(term),
            )
        )
    stmt = stmt.order_by(models.Donor.id)

    # Total count for pagination metadata
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_count = db.scalar(count_stmt) or 0
    total_pages = max(1, math.ceil(total_count / limit))
    current_page = max(1, min(page, total_pages))

    offset = (current_page - 1) * limit
    donors = list(db.scalars(stmt.offset(offset).limit(limit)))

    return {
        "donors": donors,
        "total_pages": total_pages,
        "current_page": current_page,
        "total_count": total_count,
    }


def create_donor(db: Session, payload: schemas.DonorCreate) -> models.Donor:
    donor = models.Donor(**payload.model_dump(), verified=False)
    db.add(donor)
    increment_stats(db, schemas.StatsIncrement(metric="donors", amount=1))
    db.commit()
    db.refresh(donor)
    return donor


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return great-circle distance in km between two (lat, lon) points."""
    R = 6371.0  # Earth radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def get_nearby_donors(
    db: Session,
    lat: float,
    lon: float,
    radius_km: float = 5.0,
) -> list[dict]:
    """Return donors within `radius_km` km, sorted closest-first, with distance_km field."""
    # Fetch all donors that have coordinates to avoid full-table Python loop on huge sets
    stmt = select(models.Donor).where(
        models.Donor.latitude.isnot(None),
        models.Donor.longitude.isnot(None),
    )
    all_donors = list(db.scalars(stmt))

    nearby = []
    for donor in all_donors:
        dist = _haversine_km(lat, lon, donor.latitude, donor.longitude)  # type: ignore[arg-type]
        if dist <= radius_km:
            nearby.append((donor, round(dist, 1)))

    nearby.sort(key=lambda x: x[1])  # sort by distance ascending
    return [
        {**schemas.DonorOut.model_validate(donor).model_dump(), "distance_km": dist_km}
        for donor, dist_km in nearby
    ]


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
