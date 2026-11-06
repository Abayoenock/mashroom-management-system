from datetime import datetime
from flask import g, request

from ..extensions import get_db


def audit(action, entity, entity_id=None, details=None):
    user = g.get("user")
    get_db().audit_logs.insert_one({
        "action": action,
        "entity": entity,
        "entity_id": entity_id,
        "details": details or {},
        "user_id": user["_id"] if user else None,
        "user_name": user["name"] if user else None,
        "org_id": user.get("org_id") if user else None,
        "ip": request.remote_addr if request else None,
        "created_at": datetime.utcnow(),
    })


def notify(title, message, type_="info", farm_id=None, roles=None, link=None):
    """Create an in-app notification visible to users with matching roles on the farm."""
    get_db().notifications.insert_one({
        "title": title,
        "message": message,
        "type": type_,
        "farm_id": farm_id,
        "roles": roles or [],
        "link": link,
        "read_by": [],
        "created_at": datetime.utcnow(),
    })
