from datetime import datetime, timedelta

from flask import Blueprint

from ..extensions import get_db
from ..permissions.rbac import MANAGERS, current_user, farm_scope, roles_required
from ..schemas.models import ApproveIn, HarvestIn
from ..utils.audit import audit, notify
from ..utils.crud import attach, validate
from ..utils.pagination import paginate
from ..utils.responses import ok
from ..utils.responses_base import ApiError
from ..utils.serialize import oid

bp = Blueprint("harvests", __name__, url_prefix="/api/v1/harvests")


def enrich(items):
    attach(items, "batch_id", "batches", "batch_code", "code")
    attach(items, "variety_id", "varieties", "variety_name")
    attach(items, "farm_id", "farms", "farm_name")
    return items


def next_code():
    n = get_db().harvests.count_documents({}) + 1
    while get_db().harvests.find_one({"code": f"HV-{n:05d}"}):
        n += 1
    return f"HV-{n:05d}"


@bp.get("")
@roles_required()
def list_harvests():
    items, meta = paginate(get_db().harvests, farm_scope(), ("code", "worker", "notes"),
                           ("status", "batch_id", "variety_id", "grade", "flush"), default_sort="date")
    return ok(enrich(items), meta)


@bp.post("")
@roles_required(*MANAGERS, "farm_worker")
def create_harvest():
    db = get_db()
    data = validate(HarvestIn)
    b = db.batches.find_one({"_id": data["batch_id"], "deleted_at": None, **farm_scope()})
    if not b:
        raise ApiError("Batch not found", 422, {"batch_id": "Unknown batch"})
    if b["stage"] not in ("fruiting", "harvesting"):
        raise ApiError("Batch must be in the fruiting or harvesting stage to record a harvest", 422,
                       {"batch_id": "Not ready for harvest"})
    if data["bags_harvested"] > b["bags"]:
        raise ApiError("Bags harvested exceed batch size", 422, {"bags_harvested": "Too many"})
    if db.harvests.find_one({"batch_id": b["_id"], "flush": data["flush"], "status": {"$ne": "rejected"},
                             "deleted_at": None}):
        raise ApiError(f"Flush {data['flush']} is already recorded for this batch", 409, {"flush": "Duplicate"})
    now = datetime.utcnow()
    data.update(code=next_code(), variety_id=b["variety_id"], farm_id=b["farm_id"], status="pending",
                submitted_by=current_user()["name"], created_at=now, updated_at=now, deleted_at=None)
    hid = db.harvests.insert_one(data).inserted_id
    if b["stage"] == "fruiting":
        db.batches.update_one({"_id": b["_id"]}, {"$set": {"stage": "harvesting", "stage_changed_at": now}})
        db.stage_history.insert_one({"batch_id": b["_id"], "from": "fruiting", "to": "harvesting", "at": now,
                                     "by": current_user()["name"], "notes": f"First harvest {data['code']} recorded"})
    notify("Harvest awaiting approval", f"{data['code']} · {b['code']} flush {data['flush']} · {data['weight_kg']} kg",
           "approval", b["farm_id"], ["farm_owner", "farm_manager"], "/app/harvests")
    audit("create", "harvests", hid)
    return ok(db.harvests.find_one({"_id": hid}), status=201, message="Harvest submitted for approval")


@bp.patch("/<id_>/approve")
@roles_required(*MANAGERS)
def approve(id_):
    db = get_db()
    data = validate(ApproveIn)
    now = datetime.utcnow()
    new_status = "approved" if data["action"] == "approve" else "rejected"
    # atomic state transition guards against double-approval
    h = db.harvests.find_one_and_update(
        {"_id": oid(id_), "status": "pending", "deleted_at": None, **farm_scope()},
        {"$set": {"status": new_status, "approved_by": current_user()["name"], "approved_at": now,
                  "review_notes": data.get("notes", "")}})
    if not h:
        raise ApiError("Harvest not found or already reviewed", 409)
    if new_status == "approved":
        b = db.batches.find_one({"_id": h["batch_id"]})
        lot = {
            "farm_id": h["farm_id"], "variety_id": h["variety_id"], "harvest_id": h["_id"], "batch_id": h["batch_id"],
            "batch_code": b["code"] if b else None, "grade": h["grade"], "quantity_kg": h["weight_kg"],
            "available_kg": h["weight_kg"], "harvest_date": h["date"],
            "expiry_date": h["date"] + timedelta(days=data["shelf_life_days"]),
            "location": data.get("storage_location") or "Cold Room 1", "created_at": now, "deleted_at": None,
        }
        lot_id = db.stock_lots.insert_one(lot).inserted_id
        db.inventory_transactions.insert_one({
            "lot_id": lot_id, "farm_id": h["farm_id"], "type": "harvest", "direction": "in",
            "quantity": h["weight_kg"], "unit": "kg", "reference": h["code"], "by": current_user()["name"],
            "created_at": now})
        db.batches.update_one({"_id": h["batch_id"]}, {"$inc": {
            "harvested_kg": h["weight_kg"], "rejected_kg": h.get("rejected_kg", 0), "flush_count": 1}})
    notify(f"Harvest {new_status}", f"{h['code']} · {h['weight_kg']} kg", "harvest", h["farm_id"],
           ["farm_owner", "farm_manager", "farm_worker", "sales_manager"], "/app/harvests")
    audit(new_status, "harvests", h["_id"])
    return ok(db.harvests.find_one({"_id": h["_id"]}), message=f"Harvest {new_status}")


@bp.delete("/<id_>")
@roles_required(*MANAGERS)
def delete(id_):
    res = get_db().harvests.update_one({"_id": oid(id_), "status": "pending", **farm_scope()},
                                       {"$set": {"deleted_at": datetime.utcnow()}})
    if not res.matched_count:
        raise ApiError("Only pending harvests can be deleted", 400)
    audit("delete", "harvests", oid(id_))
    return ok(message="Harvest deleted")


@bp.get("/reports")
@roles_required()
def reports():
    db = get_db()
    m = {"status": "approved", "deleted_at": None, **farm_scope()}
    by_variety = list(db.harvests.aggregate([
        {"$match": m}, {"$group": {"_id": "$variety_id", "kg": {"$sum": "$weight_kg"}, "rejected": {"$sum": "$rejected_kg"},
                                   "bags": {"$sum": "$bags_harvested"}, "count": {"$sum": 1}}},
        {"$lookup": {"from": "varieties", "localField": "_id", "foreignField": "_id", "as": "v"}},
        {"$project": {"name": {"$first": "$v.name"}, "kg": 1, "rejected": 1, "count": 1,
                      "yield_per_bag": {"$cond": [{"$gt": ["$bags", 0]}, {"$divide": ["$kg", "$bags"]}, 0]}}},
        {"$sort": {"kg": -1}}]))
    by_flush = list(db.harvests.aggregate([
        {"$match": m}, {"$group": {"_id": "$flush", "kg": {"$sum": "$weight_kg"}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}]))
    by_month = list(db.harvests.aggregate([
        {"$match": m}, {"$group": {"_id": {"$dateToString": {"format": "%Y-%m", "date": "$date"}},
                                   "kg": {"$sum": "$weight_kg"}, "rejected": {"$sum": "$rejected_kg"}}},
        {"$sort": {"_id": 1}}]))
    return ok({"by_variety": by_variety, "by_flush": by_flush, "by_month": by_month})
