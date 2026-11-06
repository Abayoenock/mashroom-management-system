from datetime import datetime

from flask import Blueprint
from werkzeug.security import generate_password_hash

from ..extensions import get_db
from ..permissions.rbac import ADMINS, allowed_farm_ids, current_user, org_scope, roles_required
from ..schemas.models import UserIn
from ..utils.audit import audit
from ..utils.crud import validate
from ..utils.pagination import paginate
from ..utils.responses import ok
from ..utils.responses_base import ApiError
from ..utils.serialize import oid

bp = Blueprint("users", __name__, url_prefix="/api/v1/users")


def scope():
    return org_scope()


def check_assignment(data):
    """Validate role/farm assignment and set the user's organization. Returns the org id."""
    me = current_user()
    if me["role"] != "super_admin":
        if data["role"] == "super_admin":
            raise ApiError("Only a super admin can assign this role", 403)
        allowed = set(allowed_farm_ids())
        if not set(data["farm_ids"]) <= allowed:
            raise ApiError("You can only assign users to your own farms", 403)
        data["org_id"] = me["org_id"]
        return
    # super admin
    if data["role"] == "super_admin":
        data["org_id"], data["farm_ids"] = None, []
        return
    if not data["farm_ids"]:
        raise ApiError("Assign at least one farm (this also sets the user's organization)", 422, {"farm_id": "Required"})
    orgs = {f.get("org_id") for f in get_db().farms.find({"_id": {"$in": data["farm_ids"]}}, {"org_id": 1})}
    if len(orgs) != 1:
        raise ApiError("All assigned farms must belong to the same organization", 422, {"farm_id": "Mixed organizations"})
    data["org_id"] = orgs.pop()


@bp.get("")
@roles_required(*ADMINS)
def list_users():
    items, meta = paginate(get_db().users, scope(), ("name", "email"), ("role", "org_id"), default_sort="name")
    farms = {f["_id"]: f["name"] for f in get_db().farms.find({}, {"name": 1})}
    orgs = {o["_id"]: o["name"] for o in get_db().organizations.find({}, {"name": 1})}
    for u in items:
        u["farm_names"] = [farms.get(f) for f in u.get("farm_ids", []) if f in farms]
        u["org_name"] = orgs.get(u.get("org_id"))
        for k in ("verify_token", "reset_token", "reset_expires"):
            u.pop(k, None)
    return ok(items, meta)


@bp.post("")
@roles_required(*ADMINS)
def create_user():
    data = validate(UserIn)
    check_assignment(data)
    db = get_db()
    data["email"] = data["email"].lower()
    if db.users.find_one({"email": data["email"]}):
        raise ApiError("Email already in use", 409, {"email": "Already registered"})
    pw = data.pop("password", None) or "password123"
    now = datetime.utcnow()
    data.update(password_hash=generate_password_hash(pw), email_verified=True,
                created_at=now, updated_at=now, deleted_at=None)
    uid = db.users.insert_one(data).inserted_id
    audit("create", "users", uid)
    return ok(db.users.find_one({"_id": uid}), status=201, message="User created")


@bp.put("/<id_>")
@roles_required(*ADMINS)
def update_user(id_):
    data = validate(UserIn)
    check_assignment(data)
    db = get_db()
    u = db.users.find_one({"_id": oid(id_), "deleted_at": None, **scope()})
    if not u:
        raise ApiError("Not found", 404)
    pw = data.pop("password", None)
    data["email"] = data["email"].lower()
    if pw:
        data["password_hash"] = generate_password_hash(pw)
    data["updated_at"] = datetime.utcnow()
    db.users.update_one({"_id": u["_id"]}, {"$set": data})
    audit("update", "users", u["_id"])
    return ok(db.users.find_one({"_id": u["_id"]}), message="User updated")


@bp.delete("/<id_>")
@roles_required(*ADMINS)
def delete_user(id_):
    db = get_db()
    u = db.users.find_one({"_id": oid(id_), "deleted_at": None, **scope()})
    if not u:
        raise ApiError("Not found", 404)
    if u["_id"] == current_user()["_id"]:
        raise ApiError("You cannot delete your own account", 400)
    db.users.update_one({"_id": u["_id"]}, {"$set": {"deleted_at": datetime.utcnow(), "active": False}})
    audit("delete", "users", u["_id"])
    return ok(message="User removed")
