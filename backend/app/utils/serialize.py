from datetime import date, datetime
from bson import ObjectId
from bson.errors import InvalidId

from .responses_base import ApiError  # noqa: F401  (re-export convenience)


def to_json(value):
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, dict):
        return {("id" if k == "_id" else k): to_json(v) for k, v in value.items() if k not in ("password_hash",)}
    if isinstance(value, (list, tuple)):
        return [to_json(v) for v in value]
    return value


def oid(value, field="id"):
    if isinstance(value, ObjectId):
        return value
    try:
        return ObjectId(str(value))
    except (InvalidId, TypeError):
        raise ApiError(f"Invalid {field}", 400)


def to_mongo(data: dict) -> dict:
    """Convert *_id string fields to ObjectId and date objects to datetimes."""
    out = {}
    for k, v in data.items():
        if (k.endswith("_id") or k.endswith("_ids")) and v not in (None, ""):
            if isinstance(v, list):
                out[k] = [oid(x, k) for x in v]
            else:
                out[k] = oid(v, k)
        elif isinstance(v, date) and not isinstance(v, datetime):
            out[k] = datetime(v.year, v.month, v.day)
        elif isinstance(v, list):
            out[k] = [to_mongo(x) if isinstance(x, dict) else x for x in v]
        elif isinstance(v, dict):
            out[k] = to_mongo(v)
        else:
            out[k] = None if v == "" and k.endswith("_id") else v
    return out
