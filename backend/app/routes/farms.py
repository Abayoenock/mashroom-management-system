from flask import Blueprint

from ..extensions import get_db
from ..permissions.rbac import ADMINS, MANAGERS
from ..schemas.models import EmployeeIn, FarmIn, RoomIn, TaskIn, VarietyIn
from ..utils.audit import notify
from ..utils.crud import attach, crud

bp = Blueprint("farms", __name__, url_prefix="/api/v1")


def enrich_farms(items):
    db = get_db()
    ids = [f["_id"] for f in items]
    rooms = {r["_id"]: r["n"] for r in db.rooms.aggregate([
        {"$match": {"farm_id": {"$in": ids}, "deleted_at": None}}, {"$group": {"_id": "$farm_id", "n": {"$sum": 1}}}])}
    batches = {r["_id"]: r["n"] for r in db.batches.aggregate([
        {"$match": {"farm_id": {"$in": ids}, "deleted_at": None, "stage": {"$ne": "completed"}}},
        {"$group": {"_id": "$farm_id", "n": {"$sum": 1}}}])}
    for f in items:
        f["rooms_count"] = rooms.get(f["_id"], 0)
        f["active_batches"] = batches.get(f["_id"], 0)
    return items


def add_farm_to_owner(fid, data):
    # every owner of the organization gets access to its new farm
    get_db().users.update_many({"org_id": data["org_id"], "role": "farm_owner"}, {"$addToSet": {"farm_ids": fid}})


crud(bp, "/farms", "farms", FarmIn, write_roles=ADMINS, search=("name", "code", "location"),
     filters=("status",), enrich=enrich_farms, unique="code", after_create=add_farm_to_owner, sort="name", scope_kind="farms")


def enrich_rooms(items):
    attach(items, "farm_id", "farms", "farm_name")
    attach(items, "variety_id", "varieties", "variety_name")
    ids = [r["_id"] for r in items]
    counts = {r["_id"]: r for r in get_db().batches.aggregate([
        {"$match": {"room_id": {"$in": ids}, "deleted_at": None, "stage": {"$ne": "completed"}}},
        {"$group": {"_id": "$room_id", "n": {"$sum": 1}, "bags": {"$sum": "$bags"}}}])}
    for r in items:
        c = counts.get(r["_id"], {})
        r["active_batches"] = c.get("n", 0)
        r["bags_in_use"] = c.get("bags", 0)
    return items


crud(bp, "/rooms", "rooms", RoomIn, write_roles=MANAGERS, search=("name", "code"),
     filters=("farm_id", "status", "variety_id"), enrich=enrich_rooms, sort="code",
     refs={"variety_id": ("varieties", "org")})

crud(bp, "/varieties", "varieties", VarietyIn, write_roles=ADMINS, search=("name", "scientific_name"),
     scope_kind="org", unique="name", sort="name")


def enrich_employees(items):
    attach(items, "farm_id", "farms", "farm_name")
    attach(items, "room_id", "rooms", "room_name")
    return items


crud(bp, "/employees", "employees", EmployeeIn, write_roles=MANAGERS, search=("name", "position", "phone"),
     filters=("farm_id", "status"), enrich=enrich_employees, sort="name", refs={"room_id": ("rooms", "farm")})


def enrich_tasks(items):
    attach(items, "farm_id", "farms", "farm_name")
    attach(items, "employee_id", "employees", "employee_name")
    attach(items, "room_id", "rooms", "room_name")
    return items


def task_created(tid, data):
    emp = get_db().employees.find_one({"_id": data.get("employee_id")}) if data.get("employee_id") else None
    notify("New task assigned", f"{data['title']}" + (f" → {emp['name']}" if emp else ""), "task",
           data["farm_id"], ["farm_manager", "farm_worker"], "/app/tasks")


crud(bp, "/tasks", "tasks", TaskIn, write_roles=MANAGERS + ("farm_worker",), delete_roles=MANAGERS,
     search=("title", "description"), filters=("farm_id", "status", "priority", "employee_id"),
     enrich=enrich_tasks, after_create=task_created, sort="due_date",
     refs={"employee_id": ("employees", "farm"), "room_id": ("rooms", "farm")})
