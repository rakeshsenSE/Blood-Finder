"""BloodFinder Bangladesh — FastAPI application entrypoint.

Run with:  uvicorn main:app --reload
Docs:      http://localhost:8000/docs
"""

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import crud
import models
import schemas
from database import Base, SessionLocal, engine, get_db
from seed import seed_blood_banks


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_blood_banks(db)
    yield


app = FastAPI(
    title="BloodFinder Bangladesh API",
    version="1.0.0",
    description="Donors, emergency blood requests, blood banks and live impact stats.",
    lifespan=lifespan,
)

# ---------- CORS ----------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

API = "/api/v1"


@app.get("/", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "bloodfinder-api"}


# ---------- Stats ----------
@app.get(f"{API}/stats", response_model=schemas.StatsOut, tags=["stats"])
def read_stats(db: Session = Depends(get_db)) -> models.Stats:
    return crud.get_stats(db)


@app.post(f"{API}/stats/increment", response_model=schemas.StatsOut, tags=["stats"])
def bump_stats(
    payload: schemas.StatsIncrement, db: Session = Depends(get_db)
) -> models.Stats:
    return crud.increment_stats(db, payload)


# ---------- Donors ----------
@app.get(f"{API}/donors/nearby", response_model=list[schemas.DonorNearbyOut], tags=["donors"])
def read_nearby_donors(
    lat: float = Query(..., description="User latitude"),
    lon: float = Query(..., description="User longitude"),
    radius: float = Query(default=5.0, ge=0.1, le=100.0, description="Search radius in km"),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Return donors within `radius` km of the given coordinates, sorted closest-first."""
    return crud.get_nearby_donors(db, lat=lat, lon=lon, radius_km=radius)


@app.get(f"{API}/donors", response_model=schemas.PaginatedDonors, tags=["donors"])
@app.get("/api/donors", response_model=schemas.PaginatedDonors, tags=["donors"])
def read_donors(
    blood_group: str | None = Query(default=None),
    division: str | None = Query(default=None),
    district: str | None = Query(default=None),
    hospital_or_area: str | None = Query(default=None),
    page: int = Query(default=1, ge=1, description="Page number (1-based)"),
    limit: int = Query(default=6, ge=1, le=50, description="Donors per page"),
    db: Session = Depends(get_db),
) -> dict:
    return crud.list_donors(
        db,
        blood_group or None,
        division or None,
        district or None,
        hospital_or_area or None,
        page=page,
        limit=limit,
    )


@app.post(
    f"{API}/donors", response_model=schemas.DonorOut, status_code=201, tags=["donors"]
)
def register_donor(
    payload: schemas.DonorCreate, db: Session = Depends(get_db)
) -> models.Donor:
    return crud.create_donor(db, payload)


# ---------- SOS / Emergency requests ----------
@app.get(f"{API}/requests/active-count", tags=["sos-requests"])
@app.get("/api/requests/active-count", tags=["sos-requests"])
def read_active_requests_count(db: Session = Depends(get_db)) -> dict[str, int]:
    return crud.get_active_requests_count(db)


@app.get(f"{API}/sos-requests", response_model=list[schemas.BloodRequestOut], tags=["sos-requests"])
@app.get(f"{API}/requests", response_model=list[schemas.BloodRequestOut], tags=["sos-requests"])
@app.get(f"{API}/emergency-requests", response_model=list[schemas.BloodRequestOut], tags=["sos-requests"])
@app.get("/api/sos-requests", response_model=list[schemas.BloodRequestOut], tags=["sos-requests"])
def read_requests(db: Session = Depends(get_db)) -> list[schemas.BloodRequestOut]:
    return crud.list_requests(db)


@app.post(f"{API}/sos-requests", response_model=schemas.BloodRequestOut, status_code=201, tags=["sos-requests"])
@app.post(f"{API}/requests", response_model=schemas.BloodRequestOut, status_code=201, tags=["sos-requests"])
@app.post(f"{API}/emergency-requests", response_model=schemas.BloodRequestOut, status_code=201, tags=["sos-requests"])
@app.post("/api/sos-requests", response_model=schemas.BloodRequestOut, status_code=201, tags=["sos-requests"])
def create_request(
    payload: schemas.BloodRequestCreate, db: Session = Depends(get_db)
) -> schemas.BloodRequestOut:
    return crud.create_request(db, payload)


# ---------- Blood banks ----------
@app.get(
    f"{API}/blood-banks", response_model=list[schemas.BloodBankOut], tags=["blood-banks"]
)
def read_blood_banks(db: Session = Depends(get_db)) -> list[models.BloodBank]:
    return crud.list_blood_banks(db)


# ---------- Contact audit log ----------
@app.post(
    f"{API}/log-contact",
    response_model=schemas.ContactLogOut,
    status_code=201,
    tags=["audit"],
)
def log_contact(
    payload: schemas.ContactLogCreate, db: Session = Depends(get_db)
) -> models.ContactLog:
    """Record that a signed-in user revealed a donor's contact details."""
    entry = models.ContactLog(
        viewer_email=payload.viewer_email,
        donor_id=payload.donor_id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
