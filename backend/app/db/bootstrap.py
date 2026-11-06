from datetime import datetime

from werkzeug.security import generate_password_hash


def ensure_superadmin(db, config, logger=None):
    """Create the platform super admin from SUPERADMIN_* settings if that account doesn't exist yet.

    An existing account is never modified, so changing the password in the UI sticks across restarts."""
    email, password = config.get("SUPERADMIN_EMAIL"), config.get("SUPERADMIN_PASSWORD")
    if not email or not password:
        if logger:
            logger.warning("SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD not set - no super admin bootstrapped")
        return None
    if len(password) < 8:
        raise RuntimeError("SUPERADMIN_PASSWORD must be at least 8 characters")
    existing = db.users.find_one({"email": email})
    if existing:
        return existing["_id"]
    now = datetime.utcnow()
    return db.users.insert_one({
        "name": config.get("SUPERADMIN_NAME") or "Platform Admin", "email": email,
        "password_hash": generate_password_hash(password), "role": "super_admin", "farm_ids": [],
        "active": True, "email_verified": True, "created_at": now, "updated_at": now, "deleted_at": None,
    }).inserted_id
