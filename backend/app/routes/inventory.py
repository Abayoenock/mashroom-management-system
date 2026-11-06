from datetime import datetime, timedelta

from flask import Blueprint, request

from ..extensions import get_db
from ..permissions.rbac import MANAGERS, current_user, farm_scope, roles_required
from ..schemas.models import InventoryItemIn, InvTxnIn
from ..utils.audit import audit, notify
from ..utils.crud import attach, crud, validate
from ..utils.pagination import paginate
from ..utils.responses import ok
from ..utils.responses_base import ApiError

bp = Blueprint("inventory", __name__, url_prefix="/api/v1/inventory")


def enrich_items(items):
    attach(items, "farm_id", "farms", "farm_name")
    for i in items:
        i["low_stock"] = i["quantity"] <= i["min_level"]
    return items


crud(bp, "/items", "inventory_items", InventoryItemIn, write_roles=MANAGERS, search=("name", "sku", "location"),
     filters=("farm_id", "category"), enrich=enrich_items, sort="name")  # farm-scoped


@bp.get("/stock")
@roles_required()
def stock():
    """Fresh mushroom stock lots."""
    flt = farm_scope()
    if request.args.get("available") == "true":
        flt["available_kg"] = {"$gt": 0}
    items, meta = paginate(get_db().stock_lots, flt, ("batch_code", "location", "grade"),
                           ("variety_id", "grade", "farm_id"), default_sort="harvest_date")
    attach(items, "variety_id", "varieties", "variety_name")
    attach(items, "farm_id", "farms", "farm_name")
    now = datetime.utcnow()
    for lot in items:
        lot["expired"] = lot["expiry_date"] < now
        lot["expiring_soon"] = not lot["expired"] and lot["expiry_date"] < now + timedelta(days=2)
    return ok(items, meta)


@bp.get("/stock/summary")
@roles_required()
def stock_summary():
    rows = list(get_db().stock_lots.aggregate([
        {"$match": {"deleted_at": None, "available_kg": {"$gt": 0}, "expiry_date": {"$gte": datetime.utcnow()},
                    **farm_scope()}},
        {"$group": {"_id": "$variety_id", "available_kg": {"$sum": "$available_kg"}, "lots": {"$sum": 1}}},
        {"$lookup": {"from": "varieties", "localField": "_id", "foreignField": "_id", "as": "v"}},
        {"$project": {"variety_name": {"$first": "$v.name"}, "price_per_kg": {"$first": "$v.price_per_kg"},
                      "available_kg": {"$round": ["$available_kg", 2]}, "lots": 1}},
        {"$sort": {"variety_name": 1}}]))
    return ok(rows)


@bp.get("/transactions")
@roles_required()
def transactions():
    items, meta = paginate(get_db().inventory_transactions, farm_scope(), ("reference", "notes", "by"),
                           ("type", "item_id", "lot_id", "direction"))
    attach(items, "item_id", "inventory_items", "item_name")
    attach(items, "lot_id", "stock_lots", "lot_batch", "batch_code")
    return ok(items, meta)


@bp.post("/transactions")
@roles_required(*MANAGERS)
def add_transaction():
    db = get_db()
    data = validate(InvTxnIn)
    qty = data["quantity"]
    direction = data["direction"] if data["type"] == "adjustment" else ("in" if data["type"] == "received" else "out")
    delta = qty if direction == "in" else -qty
    now = datetime.utcnow()
    if data.get("item_id"):
        coll, field, key = db.inventory_items, "quantity", data["item_id"]
    elif data.get("lot_id"):
        coll, field, key = db.stock_lots, "available_kg", data["lot_id"]
    else:
        raise ApiError("item_id or lot_id is required", 422)
    guard = {"_id": key, "deleted_at": None, **farm_scope()}
    if delta < 0:
        guard[field] = {"$gte": qty}
    doc = coll.find_one_and_update(guard, {"$inc": {field: delta}, "$set": {"updated_at": now}}, return_document=True)
    if not doc:
        raise ApiError("Item not found or insufficient quantity", 409, {"quantity": "Insufficient stock"})
    db.inventory_transactions.insert_one({
        "item_id": data.get("item_id"), "lot_id": data.get("lot_id"), "farm_id": doc["farm_id"], "type": data["type"],
        "direction": direction, "quantity": qty, "unit": doc.get("unit", "kg"), "notes": data.get("notes", ""),
        "by": current_user()["name"], "created_at": now})
    if data.get("item_id") and doc["quantity"] <= doc["min_level"]:
        notify("Low stock", f"{doc['name']} is at {doc['quantity']} {doc['unit']} (min {doc['min_level']})",
               "inventory", doc["farm_id"], ["farm_owner", "farm_manager"], "/app/inventory")
    audit("inventory_txn", coll.name, doc["_id"], {"type": data["type"], "qty": delta})
    return ok(doc, status=201, message="Stock updated")


@bp.get("/low-stock")
@roles_required()
def low_stock():
    items = list(get_db().inventory_items.find({"deleted_at": None, **farm_scope(),
                                                "$expr": {"$lte": ["$quantity", "$min_level"]}}).sort("name", 1))
    return ok(enrich_items(items))
