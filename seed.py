"""Real Bangladesh blood bank directory seed data."""

from sqlalchemy import select
from sqlalchemy.orm import Session

import models

BLOOD_BANKS_DATA = [
    (
        "Bangladesh Red Crescent Society (Central Blood Center)",
        "684/86, Bara Moghbazar, Dhaka",
        "+88029330188",
        "Whole blood, Component separation, Screening & safe transfusion",
        "Open 24/7",
    ),
    (
        "Quantum Foundation Blood Bank",
        "31/V Shilpacharya Zainul Abedin Sarak, Shantinagar, Dhaka",
        "+8809612010101",
        "Free blood distribution, Component therapy, Screening",
        "Open 24/7",
    ),
    (
        "Sandhani (Dhaka Medical College Unit)",
        "Dhaka Medical College Campus, Secretariate Road, Dhaka",
        "+880255165088",
        "Voluntary blood donation, Eye bank, Emergency donor supply",
        "Open 24/7",
    ),
    (
        "Badhan (BUET Central Unit)",
        "BUET Campus, Palashi, Dhaka",
        "+88029665650",
        "Voluntary blood donation, Blood grouping, Emergency donor search",
        "Sun–Thu: 4 PM – 9 PM",
    ),
    (
        "Central Police Hospital Blood Bank",
        "Rajarbagh, Dhaka",
        "+88029334188",
        "Transfusion medicine, Emergency blood store, Screening",
        "Open 24/7",
    ),
    (
        "Transfusion Medicine Dept — Dhaka Medical College Hospital",
        "Ramna, Dhaka",
        "+880255165000",
        "Whole blood, Plateletpheresis, Plasma exchange, Screening",
        "Open 24/7",
    ),
    (
        "Transfusion Medicine Dept — Chittagong Medical College Hospital",
        "KB Fazlul Kader Road, Panchlaish, Chittagong",
        "+88031619400",
        "Blood banking, Cross-matching, Emergency transfusion",
        "Open 24/7",
    ),
    (
        "Bangladesh Red Crescent Society (Chittagong Unit)",
        "Dampara, WASA Circle, Chittagong",
        "+88031615795",
        "Blood collection, Screening, Emergency distribution",
        "Sat–Thu: 8 AM – 8 PM",
    ),
    (
        "Transfusion Medicine Dept — Sylhet MAG Osmani Medical College Hospital",
        "Medical Road, Kajalshah, Sylhet",
        "+880821713667",
        "Blood transfusion, Component therapy, Emergency blood store",
        "Open 24/7",
    ),
    (
        "Transfusion Medicine Dept — Rajshahi Medical College Hospital",
        "Laxmipur, Rajshahi",
        "+8802588854400",
        "Blood banking, Cross-matching, Screening, Voluntary donor drives",
        "Open 24/7",
    ),
    (
        "Red Crescent Blood Center (Rajshahi Unit)",
        "Kazihata, Rajshahi",
        "+880721772412",
        "Voluntary blood donation, Screening & Component storage",
        "Sat–Thu: 9 AM – 6 PM",
    ),
    (
        "Transfusion Medicine Dept — Khulna Medical College Hospital",
        "Boyra, Khulna",
        "+88041760350",
        "Blood banking, Component separation, Emergency transfusion",
        "Open 24/7",
    ),
    (
        "Transfusion Medicine Dept — Sher-e-Bangla Medical College Hospital",
        "Band Road, Barishal",
        "+8804312173540",
        "Safe blood transfusion, Screening, Voluntary donation",
        "Open 24/7",
    ),
    (
        "Transfusion Medicine Dept — Rangpur Medical College Hospital",
        "Medical East Gate, Rangpur",
        "+88052162350",
        "Emergency blood supply, Component therapy, Grouping",
        "Open 24/7",
    ),
    (
        "Transfusion Medicine Dept — Mymensingh Medical College Hospital",
        "Char Para, Mymensingh",
        "+8809166063",
        "Transfusion medicine, Screening, Donor drives",
        "Open 24/7",
    ),
]


def seed_blood_banks(db: Session, force: bool = False) -> int:
    """Inserts Bangladesh blood bank directory records if none exist or if force=True."""
    if not force and db.scalar(select(models.BloodBank.id).limit(1)) is not None:
        return 0

    if force:
        db.query(models.BloodBank).delete()
        db.commit()

    count = 0
    for name, location, phone, services, hours in BLOOD_BANKS_DATA:
        db.add(
            models.BloodBank(
                name=name,
                location=location,
                phone=phone,
                services=services,
                operating_hours=hours,
            )
        )
        count += 1

    db.commit()
    return count
