"""reset_db.py — Drop and recreate all tables to remove demo/seed data.

Run once from the backend directory:
    python reset_db.py

WARNING: This permanently deletes ALL rows in every table.
"""

from database import Base, engine
import models  # noqa: F401 — ensures all models are registered on Base.metadata


def reset():
    print("[!] Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("[OK] Tables dropped.")

    print("[*] Recreating all tables (empty schema)...")
    Base.metadata.create_all(bind=engine)
    print("[OK] Tables recreated. Database is now empty.")
    print("[DONE] Only real user registrations will appear from now on.")


if __name__ == "__main__":
    confirm = input(
        "This will DELETE all existing data. Type 'yes' to continue: "
    ).strip().lower()
    if confirm == "yes":
        reset()
    else:
        print("❌  Aborted. No changes made.")
