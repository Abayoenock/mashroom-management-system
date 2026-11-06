from datetime import datetime, timedelta

from flask import Blueprint

from ..extensions import get_db
from ..permissions.rbac import farm_scope, roles_required
from ..utils.crud import attach
from ..utils.responses import ok
from .production import batch_flags

bp = Blueprint("dashboard", __name__, url_prefix="/api/v1/dashboard")

STAGE_ORDER = ["substrate_preparation", "sterilization", "spawning", "incubation", "pinning", "fruiting",
               "harvesting", "completed"]


def months_back(n=6):
    now = datetime.utcnow()
    y, m = now.year, now.month
    out = []
    for _ in range(n):
        out.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return list(reversed(out))


def month_start(n=6):
    first = months_back(n)[0]
    return datetime.strptime(first + "-01", "%Y-%m-%d")


def monthly(coll, match, value, date_field="date", n=6):
    rows = {r["_id"]: r["v"] for r in get_db()[coll].aggregate([
        {"$match": {**match, date_field: {"$gte": month_start(n)}}},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m", "date": f"${date_field}"}}, "v": {"$sum": value}}}])}
    return {m: round(rows.get(m, 0), 2) for m in months_back(n)}


def kpis(scope):
    db = get_db()
    active = {"deleted_at": None, "stage": {"$ne": "completed"}, **scope}
    agg = next(db.batches.aggregate([{"$match": active}, {"$group": {
        "_id": None, "n": {"$sum": 1}, "bags": {"$sum": "$bags"}, "expected": {"$sum": "$expected_yield_kg"},
        "actual": {"$sum": "$harvested_kg"},
        "growing": {"$sum": {"$cond": [{"$in": ["$stage", ["incubation", "pinning", "fruiting", "harvesting"]]}, 1, 0]}}}}]),
        {})
    stock = next(db.stock_lots.aggregate([{"$match": {"deleted_at": None, "available_kg": {"$gt": 0},
                                                      "expiry_date": {"$gte": datetime.utcnow()}, **scope}},
                                          {"$group": {"_id": None, "kg": {"$sum": "$available_kg"}}}]), {})
    since = datetime.utcnow() - timedelta(days=365)
    sales = next(db.sales.aggregate([{"$match": {"deleted_at": None, "status": "confirmed", "date": {"$gte": since}, **scope}},
                                     {"$group": {"_id": None, "rev": {"$sum": "$total"}, "out": {"$sum": "$balance"}}}]), {})
    return {
        "active_batches": agg.get("n", 0),
        "growing_bags": agg.get("bags", 0),
        "production_cycles": agg.get("growing", 0),
        "expected_harvest_kg": round(agg.get("expected", 0), 1),
        "actual_harvest_kg": round(agg.get("actual", 0), 1),
        "stock_kg": round(stock.get("kg", 0), 1),
        "revenue": round(sales.get("rev", 0), 2),
        "outstanding": round(sales.get("out", 0), 2),
        "pending_orders": db.sales.count_documents({"deleted_at": None, "status": "confirmed",
                                                    "delivery_status": {"$ne": "delivered"}, **scope}),
        "pending_harvests": db.harvests.count_documents({"deleted_at": None, "status": "pending", **scope}),
    }


def production_charts(scope):
    db = get_db()
    harvested = monthly("harvests", {"deleted_at": None, "status": "approved", **scope}, "$weight_kg")
    rejected = monthly("harvests", {"deleted_at": None, "status": "approved", **scope}, "$rejected_kg")
    started = monthly("batches", {"deleted_at": None, **scope}, 1, "spawning_date")
    production = [{"month": m, "harvested": harvested[m], "rejected": rejected[m], "batches": started[m]}
                  for m in harvested]
    stages = {r["_id"]: r["n"] for r in db.batches.aggregate([
        {"$match": {"deleted_at": None, **scope}}, {"$group": {"_id": "$stage", "n": {"$sum": 1}}}])}
    stage_dist = [{"stage": s, "count": stages.get(s, 0)} for s in STAGE_ORDER]
    variety_dist = list(db.batches.aggregate([
        {"$match": {"deleted_at": None, "stage": {"$ne": "completed"}, **scope}},
        {"$group": {"_id": "$variety_id", "bags": {"$sum": "$bags"}, "batches": {"$sum": 1}}},
        {"$lookup": {"from": "varieties", "localField": "_id", "foreignField": "_id", "as": "v"}},
        {"$project": {"name": {"$first": "$v.name"}, "color": {"$first": "$v.color"}, "bags": 1, "batches": 1}},
        {"$sort": {"bags": -1}}]))
    return {"production": production, "stage_distribution": stage_dist, "variety_distribution": variety_dist}


def harvest_charts(scope):
    rows = list(get_db().batches.aggregate([
        {"$match": {"deleted_at": None, "harvested_kg": {"$gt": 0}, **scope}},
        {"$group": {"_id": "$variety_id", "expected": {"$sum": "$expected_yield_kg"}, "actual": {"$sum": "$harvested_kg"}}},
        {"$lookup": {"from": "varieties", "localField": "_id", "foreignField": "_id", "as": "v"}},
        {"$project": {"name": {"$first": "$v.name"}, "expected": {"$round": ["$expected", 1]},
                      "actual": {"$round": ["$actual", 1]}}},
        {"$sort": {"name": 1}}]))
    return {"harvest_performance": rows}


def sales_charts(scope):
    m = {"deleted_at": None, "status": "confirmed", **scope}
    rev = monthly("sales", m, "$total")
    exp = monthly("expenses", {"deleted_at": None, **scope}, "$amount")
    kg = monthly("sales", m, {"$sum": "$items.quantity_kg"})
    sales_trend = [{"month": k, "revenue": rev[k], "kg": kg[k]} for k in rev]
    performance = [{"month": k, "revenue": rev[k], "expenses": exp[k], "profit": round(rev[k] - exp[k], 2)} for k in rev]
    by_variety = list(get_db().sales.aggregate([
        {"$match": m}, {"$unwind": "$items"},
        {"$group": {"_id": "$items.variety_name", "revenue": {"$sum": "$items.line_total"},
                    "kg": {"$sum": "$items.quantity_kg"}}},
        {"$sort": {"revenue": -1}}]))
    return {"sales_trend": sales_trend, "monthly_performance": performance, "revenue_by_variety": by_variety}


def recent_activity(scope, limit=8):
    """Farm-scoped activity feed built from stage changes, harvests and sales."""
    db = get_db()
    batch_ids = [b["_id"] for b in db.batches.find({"deleted_at": None, **scope}, {"_id": 1})]
    codes = {b["_id"]: b["code"] for b in db.batches.find({"_id": {"$in": batch_ids}}, {"code": 1})}
    feed = []
    for h in db.stage_history.find({"batch_id": {"$in": batch_ids}}).sort("at", -1).limit(limit):
        feed.append({"type": "stage", "at": h["at"], "by": h.get("by"), "link": f"/app/production/{h['batch_id']}",
                     "text": f"{codes.get(h['batch_id'])} moved to {h['to'].replace('_', ' ')}"})
    for h in db.harvests.find({"deleted_at": None, **scope}).sort("created_at", -1).limit(limit):
        feed.append({"type": "harvest", "at": h["created_at"], "by": h.get("submitted_by"), "link": "/app/harvests",
                     "text": f"Harvest {h['code']} · {h['weight_kg']} kg ({h['status']})"})
    for s in db.sales.find({"deleted_at": None, **scope}).sort("created_at", -1).limit(limit):
        feed.append({"type": "sale", "at": s["created_at"], "by": s.get("sales_person"), "link": f"/app/sales/{s['_id']}",
                     "text": f"Order {s['number']} for {s['customer_name']}"})
    return sorted(feed, key=lambda x: x["at"], reverse=True)[:limit]


@bp.get("/overview")
@roles_required()
def overview():
    db = get_db()
    scope = farm_scope()
    now = datetime.utcnow()
    active = list(db.batches.find({"deleted_at": None, "stage": {"$ne": "completed"}, **scope}))
    attach(active, "variety_id", "varieties", "variety_name")
    attach(active, "room_id", "rooms", "room_name")
    upcoming = sorted([b for b in active if b.get("expected_first_harvest") and
                       b["stage"] not in ("harvesting",) and b["expected_first_harvest"] <= now + timedelta(days=21)],
                      key=lambda b: b["expected_first_harvest"])[:6]
    attention = []
    for b in active:
        b["flags"] = batch_flags(b)
        if set(b["flags"]) & {"incubation_overdue", "contamination", "environment"}:
            attention.append(b)
    slim = lambda b: {k: b.get(k) for k in ("_id", "code", "stage", "variety_name", "room_name", "bags",
                                             "expected_first_harvest", "expected_yield_kg", "flags", "contaminated_bags")}
    recent_sales = list(db.sales.find({"deleted_at": None, **scope}).sort("date", -1).limit(6))
    low_stock = list(db.inventory_items.find({"deleted_at": None, **scope,
                                              "$expr": {"$lte": ["$quantity", "$min_level"]}}).limit(6))
    activities = recent_activity(scope)

    harvest_tot = next(db.harvests.aggregate([
        {"$match": {"deleted_at": None, "status": "approved", **scope}},
        {"$group": {"_id": None, "kg": {"$sum": "$weight_kg"}, "rej": {"$sum": "$rejected_kg"},
                    "bags": {"$sum": "$bags_harvested"}}}]), {})
    exp_tot = next(db.expenses.aggregate([{"$match": {"deleted_at": None, **scope}},
                                          {"$group": {"_id": None, "v": {"$sum": "$amount"}}}]), {}).get("v", 0)
    kg = harvest_tot.get("kg", 0)
    summary = {
        "total_harvested_kg": round(kg, 1),
        "success_rate": round(100 * kg / (kg + harvest_tot.get("rej", 0)), 1) if kg else 0,
        "avg_yield_per_bag": round(kg / harvest_tot["bags"], 3) if harvest_tot.get("bags") else 0,
        "total_expenses": round(exp_tot, 2),
        "cost_per_kg": round(exp_tot / kg, 2) if kg else 0,
    }
    return ok({
        "kpis": kpis(scope), **production_charts(scope), **harvest_charts(scope), **sales_charts(scope),
        "upcoming_harvests": [slim(b) for b in upcoming],
        "attention": [slim(b) for b in attention[:6]],
        "recent_sales": [{k: s.get(k) for k in ("_id", "number", "customer_name", "date", "total", "payment_status",
                                                "delivery_status")} for s in recent_sales],
        "low_stock": low_stock,
        "activities": activities,
        "summary": summary,
    })


@bp.get("/production")
@roles_required()
def production():
    return ok(production_charts(farm_scope()))


@bp.get("/harvest")
@roles_required()
def harvest():
    return ok(harvest_charts(farm_scope()))


@bp.get("/sales")
@roles_required()
def sales():
    return ok(sales_charts(farm_scope()))
