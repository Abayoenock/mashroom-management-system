from datetime import datetime, timedelta

from flask import Blueprint

from ..extensions import get_db
from ..permissions.rbac import MANAGERS, assert_farm_access, current_user, farm_org, farm_scope, roles_required
from ..schemas.models import STAGES, BatchIn, ObservationIn, StageIn
from ..utils.audit import audit, notify
from ..utils.crud import attach, validate
from ..utils.pagination import paginate
from ..utils.responses import ok
from ..utils.responses_base import ApiError
from ..utils.serialize import oid

bp = Blueprint("production", __name__, url_prefix="/api/v1/production")

WORKERS = MANAGERS + ("farm_worker",)


def batch_flags(b):
    """Compute derived health flags for a batch."""
    now = datetime.utcnow()
    flags = []
    if b["stage"] in ("spawning", "incubation") and b.get("expected_incubation_end") and now > b["expected_incubation_end"]:
        flags.append("incubation_overdue")
    if b["stage"] not in ("completed", "harvesting") and b.get("expected_first_harvest") and \
            now <= b["expected_first_harvest"] <= now + timedelta(days=7):
        flags.append("harvest_soon")
    if b.get("contaminated_bags", 0) > 0:
        flags.append("contamination")
    if b.get("last_env_alert"):
        flags.append("environment")
    return flags


def enrich(items):
    attach(items, "farm_id", "farms", "farm_name")
    attach(items, "room_id", "rooms", "room_name")
    attach(items, "variety_id", "varieties", "variety_name")
    for b in items:
        b["flags"] = batch_flags(b)
        exp = b.get("expected_yield_kg") or 0
        b["yield_pct"] = round(100 * b.get("harvested_kg", 0) / exp, 1) if exp else 0
    return items


def get_batch(id_):
    b = get_db().batches.find_one({"_id": oid(id_), "deleted_at": None, **farm_scope()})
    if not b:
        raise ApiError("Batch not found", 404)
    return b


def next_code():
    year = datetime.utcnow().year
    n = get_db().batches.count_documents({"code": {"$regex": f"^MB-{year}-"}}) + 1
    while get_db().batches.find_one({"code": f"MB-{year}-{n:04d}"}):
        n += 1
    return f"MB-{year}-{n:04d}"


def derive(data):
    v = get_db().varieties.find_one({"_id": data["variety_id"], "org_id": farm_org(data["farm_id"]), "deleted_at": None})
    if not v:
        raise ApiError("Variety not found", 422, {"variety_id": "Unknown variety"})
    room = get_db().rooms.find_one({"_id": data["room_id"], "farm_id": data["farm_id"], "deleted_at": None})
    if not room:
        raise ApiError("Room does not belong to the selected farm", 422, {"room_id": "Invalid room"})
    sd = data["spawning_date"]
    data["expected_incubation_end"] = sd + timedelta(days=v["incubation_days"])
    data["expected_first_harvest"] = sd + timedelta(days=v["incubation_days"] + v["fruiting_days"])
    data["expected_yield_kg"] = round(data["bags"] * v["expected_yield_kg_per_bag"], 2)
    return data


@bp.get("/batches")
@roles_required()
def list_batches():
    from flask import request
    flt = farm_scope()
    if request.args.get("active") == "true":
        flt["stage"] = {"$ne": "completed"}
    items, meta = paginate(get_db().batches, flt, ("code", "substrate_type", "worker"),
                           ("stage", "variety_id", "room_id", "farm_id"), default_sort="spawning_date")
    return ok(enrich(items), meta)


@bp.post("/batches")
@roles_required(*MANAGERS)
def create_batch():
    data = validate(BatchIn)
    assert_farm_access(data["farm_id"])
    data = derive(data)
    now = datetime.utcnow()
    data.update(code=next_code(), stage="substrate_preparation", harvested_kg=0, rejected_kg=0,
                contaminated_bags=0, flush_count=0, created_at=now, updated_at=now, deleted_at=None)
    bid = get_db().batches.insert_one(data).inserted_id
    get_db().stage_history.insert_one({"batch_id": bid, "from": None, "to": "substrate_preparation", "at": now,
                                       "by": current_user()["name"], "notes": "Batch created"})
    audit("create", "batches", bid)
    return ok(get_db().batches.find_one({"_id": bid}), status=201, message=f"Batch {data['code']} created")


@bp.get("/batches/<id_>")
@roles_required()
def get_one(id_):
    db = get_db()
    b = enrich([get_batch(id_)])[0]
    b["variety"] = db.varieties.find_one({"_id": b["variety_id"]})
    b["history"] = list(db.stage_history.find({"batch_id": b["_id"]}).sort("at", 1))
    b["observations"] = list(db.observations.find({"batch_id": b["_id"]}).sort("date", -1))
    b["harvests"] = list(db.harvests.find({"batch_id": b["_id"], "deleted_at": None}).sort("date", 1))
    b["expenses"] = list(db.expenses.find({"batch_id": b["_id"], "deleted_at": None}).sort("date", -1))
    approved = [h for h in b["harvests"] if h["status"] == "approved"]
    b["yield_per_bag"] = round(b.get("harvested_kg", 0) / b["bags"], 3) if b["bags"] else 0
    total = b.get("harvested_kg", 0) + b.get("rejected_kg", 0)
    b["success_rate"] = round(100 * b.get("harvested_kg", 0) / total, 1) if total else None
    b["approved_flushes"] = len(approved)
    return ok(b)


@bp.put("/batches/<id_>")
@roles_required(*MANAGERS)
def update_batch(id_):
    b = get_batch(id_)
    data = validate(BatchIn)
    assert_farm_access(data["farm_id"])
    data = derive(data)
    data["updated_at"] = datetime.utcnow()
    get_db().batches.update_one({"_id": b["_id"]}, {"$set": data})
    audit("update", "batches", b["_id"])
    return ok(get_db().batches.find_one({"_id": b["_id"]}), message="Batch updated")


@bp.delete("/batches/<id_>")
@roles_required(*MANAGERS)
def delete_batch(id_):
    b = get_batch(id_)
    get_db().batches.update_one({"_id": b["_id"]}, {"$set": {"deleted_at": datetime.utcnow()}})
    audit("delete", "batches", b["_id"])
    return ok(message="Batch deleted")


@bp.patch("/batches/<id_>/stage")
@roles_required(*MANAGERS)
def change_stage(id_):
    b = get_batch(id_)
    data = validate(StageIn)
    if data["stage"] == b["stage"]:
        raise ApiError("Batch is already in this stage", 400)
    if STAGES.index(data["stage"]) < STAGES.index(b["stage"]):
        raise ApiError("Stages can only move forward", 400)
    now = datetime.utcnow()
    upd = {"stage": data["stage"], "updated_at": now, "stage_changed_at": now}
    if data["stage"] == "completed":
        upd["completed_at"] = now
    get_db().batches.update_one({"_id": b["_id"]}, {"$set": upd})
    get_db().stage_history.insert_one({"batch_id": b["_id"], "from": b["stage"], "to": data["stage"], "at": now,
                                       "by": current_user()["name"], "notes": data.get("notes", "")})
    notify("Production stage changed",
           f"{b['code']}: {b['stage'].replace('_', ' ')} → {data['stage'].replace('_', ' ')}",
           "production", b["farm_id"], ["farm_owner", "farm_manager"], f"/app/production/{b['_id']}")
    audit("stage_change", "batches", b["_id"], {"from": b["stage"], "to": data["stage"]})
    return ok(get_db().batches.find_one({"_id": b["_id"]}), message="Stage updated")


@bp.get("/batches/<id_>/history")
@roles_required()
def history(id_):
    b = get_batch(id_)
    return ok(list(get_db().stage_history.find({"batch_id": b["_id"]}).sort("at", 1)))


@bp.post("/batches/<id_>/observations")
@roles_required(*WORKERS)
def add_observation(id_):
    db = get_db()
    b = get_batch(id_)
    data = validate(ObservationIn)
    if data["affected_bags"] > b["bags"]:
        raise ApiError("Affected bags exceed batch size", 422, {"affected_bags": "Too many"})
    data.update(batch_id=b["_id"], farm_id=b["farm_id"], stage=b["stage"], by=current_user()["name"],
                created_at=datetime.utcnow())
    oid_ = db.observations.insert_one(data).inserted_id
    v = db.varieties.find_one({"_id": b["variety_id"]}) or {}
    out_of_range = not (v.get("temp_min", -99) <= data["temperature"] <= v.get("temp_max", 99)) or \
        not (v.get("humidity_min", 0) <= data["humidity"] <= v.get("humidity_max", 100))
    upd = {"last_observation_at": data["date"], "last_env_alert": out_of_range}
    if data["contamination"]:
        upd["contaminated_bags"] = max(b.get("contaminated_bags", 0), data["affected_bags"])
        notify("Contamination reported", f"{b['code']}: {data['affected_bags']} bag(s) affected", "contamination",
               b["farm_id"], ["farm_owner", "farm_manager"], f"/app/production/{b['_id']}")
    if out_of_range:
        notify("Environmental alert",
               f"{b['code']}: {data['temperature']}°C / {data['humidity']}% outside recommended range",
               "environment", b["farm_id"], ["farm_owner", "farm_manager"], f"/app/production/{b['_id']}")
    db.batches.update_one({"_id": b["_id"]}, {"$set": upd})
    audit("create", "observations", oid_)
    return ok(db.observations.find_one({"_id": oid_}), status=201, message="Observation recorded")


@bp.get("/observations")
@roles_required()
def list_observations():
    items, meta = paginate(get_db().observations, farm_scope(), ("notes", "by"), ("batch_id", "contamination"),
                           default_sort="date")
    for o in items:
        o["deleted_at"] = None
    attach(items, "batch_id", "batches", "batch_code", "code")
    return ok(items, meta)
