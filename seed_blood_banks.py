"""seed_blood_banks.py — Populate real Bangladesh blood bank directory data.

Run from the backend directory:
    python seed_blood_banks.py
"""

from database import SessionLocal
from seed import seed_blood_banks


def run():
    print("[*] Seeding blood banks database table...")
    with SessionLocal() as db:
        added = seed_blood_banks(db, force=True)
        print(f"[OK] Added {added} blood bank directory entries to Supabase PostgreSQL.")


if __name__ == "__main__":
    run()
