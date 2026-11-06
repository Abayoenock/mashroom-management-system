import re
from flask import request


def paginate(collection, base_filter, search_fields=(), filter_fields=(), default_sort="created_at", pipeline_extra=None):
    """Return (items, meta) applying ?page, ?limit, ?q, ?sort, ?order and equality filters."""
    page = max(int(request.args.get("page", 1) or 1), 1)
    limit = min(max(int(request.args.get("limit", 10) or 10), 1), 500)
    q = (request.args.get("q") or "").strip()
    sort = request.args.get("sort") or default_sort
    order = -1 if (request.args.get("order") or "desc") == "desc" else 1

    flt = {"deleted_at": None, **base_filter}
    if q and search_fields:
        rx = {"$regex": re.escape(q), "$options": "i"}
        flt["$or"] = [{f: rx} for f in search_fields]
    for f in filter_fields:
        v = request.args.get(f)
        if v not in (None, "", "all"):
            if f.endswith("_id"):
                from .serialize import oid
                v = oid(v, f)
            elif v in ("true", "false"):
                v = v == "true"
            flt[f] = v

    total = collection.count_documents(flt)
    cursor = collection.find(flt).sort([(sort, order), ("_id", order)]).skip((page - 1) * limit).limit(limit)
    items = list(cursor)
    meta = {"page": page, "limit": limit, "total": total, "pages": max((total + limit - 1) // limit, 1)}
    return items, meta
