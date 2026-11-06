"""Notifications, reports and public endpoints."""
from datetime import datetime, timedelta

from flask import Blueprint, current_app, request

from ..extensions import get_db
from ..permissions.rbac import MANAGERS, allowed_farm_ids, current_user, farm_scope, org_scope, roles_required
from ..utils.crud import attach
from ..utils.responses import ok
from ..utils.responses_base import ApiError
from ..utils.serialize import oid

bp = Blueprint("misc", __name__, url_prefix="/api/v1")


# ------------------------------------------------------------ notifications

def notif_filter():
    u = current_user()
    allowed = allowed_farm_ids()
    flt = {"$and": [
        {"$or": [{"roles": {"$size": 0}}, {"roles": u["role"]}]} if u["role"] != "super_admin" else {},
        {"farm_id": {"$in": allowed}} if allowed is not None else {},
        {"created_at": {"$gte": u.get("created_at", datetime(2000, 1, 1)) - timedelta(days=365)}},
    ]}
    return flt


@bp.get("/notifications")
@roles_required()
def notifications():
    u = current_user()
    flt = notif_filter()
    if request.args.get("unread") == "true":
        flt["read_by"] = {"$ne": u["_id"]}
    limit = min(int(request.args.get("limit", 20)), 100)
    items = list(get_db().notifications.find(flt).sort("created_at", -1).limit(limit))
    for n in items:
        n["read"] = u["_id"] in n.get("read_by", [])
        n.pop("read_by", None)
    unread = get_db().notifications.count_documents({**notif_filter(), "read_by": {"$ne": u["_id"]}})
    return ok(items, {"unread": unread})


@bp.patch("/notifications/<id_>/read")
@roles_required()
def mark_read(id_):
    get_db().notifications.update_one({"_id": oid(id_)}, {"$addToSet": {"read_by": current_user()["_id"]}})
    return ok(message="Marked as read")


@bp.post("/notifications/read-all")
@roles_required()
def mark_all():
    get_db().notifications.update_many(notif_filter(), {"$addToSet": {"read_by": current_user()["_id"]}})
    return ok(message="All notifications marked as read")


# ------------------------------------------------------------ reports

def date_range(field="date"):
    f, t = request.args.get("from"), request.args.get("to")
    rng = {}
    if f:
        rng["$gte"] = datetime.fromisoformat(f)
    if t:
        rng["$lt"] = datetime.fromisoformat(t) + timedelta(days=1)
    return {field: rng} if rng else {}


@bp.get("/reports/<kind>")
@roles_required(*MANAGERS, "sales_manager")
def report(kind):
    db = get_db()
    scope = farm_scope()
    if kind == "production":
        rows = list(db.batches.find({"deleted_at": None, **scope, **date_range("spawning_date")}).sort("spawning_date", -1))
        attach(rows, "variety_id", "varieties", "variety")
        attach(rows, "room_id", "rooms", "room")
        cols = ["code", "variety", "room", "stage", "spawning_date", "bags", "expected_yield_kg", "harvested_kg",
                "rejected_kg", "yield_pct"]
        for r in rows:
            r["yield_pct"] = round(100 * r["harvested_kg"] / r["expected_yield_kg"], 1) if r.get("expected_yield_kg") else 0
        summary = {"batches": len(rows), "bags": sum(r["bags"] for r in rows),
                   "expected_kg": round(sum(r["expected_yield_kg"] for r in rows), 1),
                   "harvested_kg": round(sum(r["harvested_kg"] for r in rows), 1),
                   "losses_kg": round(sum(r.get("rejected_kg", 0) for r in rows), 1)}
    elif kind == "harvest":
        rows = list(db.harvests.find({"deleted_at": None, "status": "approved", **scope, **date_range()}).sort("date", -1))
        attach(rows, "variety_id", "varieties", "variety")
        attach(rows, "batch_id", "batches", "batch", "code")
        for r in rows:
            r["kg_per_bag"] = round(r["weight_kg"] / r["bags_harvested"], 3)
        cols = ["code", "date", "batch", "variety", "flush", "bags_harvested", "weight_kg", "kg_per_bag", "grade",
                "rejected_kg"]
        summary = {"harvests": len(rows), "kg": round(sum(r["weight_kg"] for r in rows), 1),
                   "rejected_kg": round(sum(r["rejected_kg"] for r in rows), 1)}
    elif kind == "sales":
        rows = list(db.sales.find({"deleted_at": None, **scope, **date_range()}).sort("date", -1))
        for r in rows:
            r["kg"] = round(sum(i["quantity_kg"] for i in r["items"]), 2)
        cols = ["number", "date", "customer_name", "kg", "subtotal", "discount", "total", "paid", "balance",
                "payment_status", "status"]
        ok_rows = [r for r in rows if r["status"] == "confirmed"]
        summary = {"orders": len(rows), "revenue": round(sum(r["total"] for r in ok_rows), 2),
                   "outstanding": round(sum(r["balance"] for r in ok_rows), 2),
                   "kg_sold": round(sum(r["kg"] for r in ok_rows), 1)}
    elif kind == "financial":
        rev = {r["_id"]: r["v"] for r in db.sales.aggregate([
            {"$match": {"deleted_at": None, "status": "confirmed", **scope, **date_range()}},
            {"$group": {"_id": {"$dateToString": {"format": "%Y-%m", "date": "$date"}}, "v": {"$sum": "$total"}}}])}
        exp = {r["_id"]: r["v"] for r in db.expenses.aggregate([
            {"$match": {"deleted_at": None, **scope, **date_range()}},
            {"$group": {"_id": {"$dateToString": {"format": "%Y-%m", "date": "$date"}}, "v": {"$sum": "$amount"}}}])}
        kg = {r["_id"]: r["v"] for r in db.harvests.aggregate([
            {"$match": {"deleted_at": None, "status": "approved", **scope, **date_range()}},
            {"$group": {"_id": {"$dateToString": {"format": "%Y-%m", "date": "$date"}}, "v": {"$sum": "$weight_kg"}}}])}
        months = sorted(set(rev) | set(exp) | set(kg), reverse=True)
        rows = [{"month": m, "revenue": round(rev.get(m, 0), 2), "expenses": round(exp.get(m, 0), 2),
                 "profit": round(rev.get(m, 0) - exp.get(m, 0), 2), "harvested_kg": round(kg.get(m, 0), 1),
                 "cost_per_kg": round(exp.get(m, 0) / kg[m], 2) if kg.get(m) else 0} for m in months]
        cols = ["month", "revenue", "expenses", "profit", "harvested_kg", "cost_per_kg"]
        by_cat = list(db.expenses.aggregate([{"$match": {"deleted_at": None, **scope, **date_range()}},
                                             {"$group": {"_id": "$category", "v": {"$sum": "$amount"}}},
                                             {"$sort": {"v": -1}}]))
        tr, te = sum(r["revenue"] for r in rows), sum(r["expenses"] for r in rows)
        tk = sum(r["harvested_kg"] for r in rows)
        summary = {"revenue": round(tr, 2), "expenses": round(te, 2), "profit": round(tr - te, 2),
                   "margin_pct": round(100 * (tr - te) / tr, 1) if tr else 0,
                   "cost_per_kg": round(te / tk, 2) if tk else 0,
                   "by_category": {c["_id"]: round(c["v"], 2) for c in by_cat}}
    elif kind == "inventory":
        rows = list(db.inventory_items.find({"deleted_at": None, **scope}).sort("name", 1))
        for r in rows:
            r["status"] = "low" if r["quantity"] <= r["min_level"] else "ok"
            r["value"] = round(r["quantity"] * r.get("unit_cost", 0), 2)
        lots = list(db.stock_lots.find({"deleted_at": None, "available_kg": {"$gt": 0}, **scope}))
        attach(lots, "variety_id", "varieties", "variety")
        now = datetime.utcnow()
        for lot in lots:
            rows.append({"name": f"Fresh {lot['variety']} ({lot['grade']})", "sku": lot.get("batch_code"),
                         "category": "fresh_mushrooms", "quantity": round(lot["available_kg"], 2), "unit": "kg",
                         "min_level": 0, "status": "expired" if lot["expiry_date"] < now else "ok", "value": None,
                         "location": lot.get("location")})
        cols = ["name", "sku", "category", "quantity", "unit", "min_level", "status", "value", "location"]
        summary = {"items": len(rows), "low_stock": sum(1 for r in rows if r["status"] == "low"),
                   "expired_lots": sum(1 for r in rows if r["status"] == "expired"),
                   "stock_value": round(sum(r["value"] or 0 for r in rows), 2)}
    else:
        raise ApiError("Unknown report", 404)
    rows = [{c: r.get(c) for c in cols} for r in rows]
    return ok({"columns": cols, "rows": rows, "summary": summary})


# ------------------------------------------------------------ audit + public

@bp.get("/audit-logs")
@roles_required("super_admin", "farm_owner")
def audit_logs():
    items = list(get_db().audit_logs.find(org_scope()).sort("created_at", -1).limit(100))
    return ok(items)


@bp.get("/public/stats")
def public_stats():
    db = get_db()
    kg = next(db.harvests.aggregate([{"$match": {"status": "approved", "deleted_at": None}},
                                     {"$group": {"_id": None, "v": {"$sum": "$weight_kg"}}}]), {}).get("v", 0)
    return ok({
        "farms": db.farms.count_documents({"deleted_at": None}),
        "organizations": db.organizations.count_documents({"deleted_at": None}),
        "batches": db.batches.count_documents({"deleted_at": None}),
        "harvested_kg": round(kg),
        "varieties": db.varieties.count_documents({"deleted_at": None}),
    })


@bp.get("/public/demo-accounts")
def demo_accounts():
    """Demo logins for the sign-in page. Only available when DEMO_MODE is on; never includes the super admin."""
    if not current_app.config["DEMO_MODE"]:
        return ok({"enabled": False, "accounts": []})
    users = list(get_db().users.find({"demo": True, "deleted_at": None, "active": True, "role": {"$ne": "super_admin"}},
                                     {"name": 1, "email": 1, "role": 1, "farm_ids": 1, "org_id": 1}))
    farms = {f["_id"]: f["name"] for f in get_db().farms.find({}, {"name": 1})}
    orgs = {o["_id"]: o["name"] for o in get_db().organizations.find({}, {"name": 1})}
    order = ["farm_owner", "farm_manager", "farm_worker", "sales_manager"]
    users.sort(key=lambda u: (str(orgs.get(u.get("org_id"))), order.index(u["role"]) if u["role"] in order else 99))
    return ok({"enabled": True, "password": current_app.config["DEMO_PASSWORD"], "accounts": [
        {"name": u["name"], "email": u["email"], "role": u["role"], "organization": orgs.get(u.get("org_id")),
         "farms": [farms[f] for f in u.get("farm_ids", []) if f in farms]} for u in users]})


@bp.post("/public/contact")
def contact():
    body = request.get_json(silent=True) or {}
    if not body.get("email") or not body.get("message"):
        raise ApiError("Email and message are required", 422)
    get_db().contact_messages.insert_one({**{k: str(body.get(k, ""))[:2000] for k in ("name", "email", "message")},
                                          "created_at": datetime.utcnow()})
    return ok(message="Thanks! We'll be in touch shortly.")
