"""Tenant management for the platform super admin."""
from datetime import datetime
from typing import Literal, Optional

from flask import Blueprint
from pydantic import Field
from werkzeug.security import generate_password_hash

from ..db.defaults import create_organization
from ..extensions import get_db
from ..permissions.rbac import roles_required
from ..schemas.models import Base
from ..utils.audit import audit
from ..utils.crud import validate
from ..utils.pagination import paginate
from ..utils.responses import ok
from ..utils.responses_base import ApiError
from ..utils.serialize import oid

bp = Blueprint("organizations", __name__, url_prefix="/api/v1/organizations")


class OrgCreateIn(Base):
    name: str = Field(min_length=2, max_length=120)
    owner_name: str = Field(min_length=2, max_length=100)
    owner_email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    owner_password: str = Field(min_length=8, max_length=128)


class OrgUpdateIn(Base):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    status: Optional[Literal["active", "suspended"]] = None


def stats(org_ids):
    db = get_db()
    farms = list(db.farms.find({"org_id": {"$in": org_ids}, "deleted_at": None}, {"org_id": 1}))
    farm_org = {f["_id"]: f["org_id"] for f in farms}
    out = {o: {"farms": 0, "users": 0, "customers": 0, "active_batches": 0, "revenue": 0.0} for o in org_ids}
    for f in farms:
        out[f["org_id"]]["farms"] += 1
    for r in db.users.aggregate([{"$match": {"org_id": {"$in": org_ids}, "deleted_at": None}},
                                 {"$group": {"_id": "$org_id", "n": {"$sum": 1}}}]):
        out[r["_id"]]["users"] = r["n"]
    for r in db.customers.aggregate([{"$match": {"org_id": {"$in": org_ids}, "deleted_at": None}},
                                     {"$group": {"_id": "$org_id", "n": {"$sum": 1}}}]):
        out[r["_id"]]["customers"] = r["n"]
    for r in db.batches.aggregate([{"$match": {"farm_id": {"$in": list(farm_org)}, "deleted_at": None, "stage": {"$ne": "completed"}}},
                                   {"$group": {"_id": "$farm_id", "n": {"$sum": 1}}}]):
        out[farm_org[r["_id"]]]["active_batches"] += r["n"]
    for r in db.sales.aggregate([{"$match": {"farm_id": {"$in": list(farm_org)}, "deleted_at": None, "status": "confirmed"}},
                                 {"$group": {"_id": "$farm_id", "v": {"$sum": "$total"}}}]):
        out[farm_org[r["_id"]]]["revenue"] += round(r["v"], 2)
    return out


@bp.get("")
@roles_required("super_admin")
def list_orgs():
    items, meta = paginate(get_db().organizations, {}, ("name",), ("status",), default_sort="created_at")
    st = stats([o["_id"] for o in items])
    owners = {u["_id"]: u for u in get_db().users.find({"_id": {"$in": [o.get("owner_id") for o in items]}}, {"name": 1, "email": 1})}
    for o in items:
        o.update(st[o["_id"]])
        ow = owners.get(o.get("owner_id"))
        o["owner_name"], o["owner_email"] = (ow["name"], ow["email"]) if ow else (None, None)
    return ok(items, meta)


@bp.post("")
@roles_required("super_admin")
def create_org():
    db = get_db()
    data = validate(OrgCreateIn)
    email = data["owner_email"].lower()
    if db.users.find_one({"email": email}):
        raise ApiError("A user with this email already exists", 409, {"owner_email": "Already registered"})
    now = datetime.utcnow()
    org_id, _ = create_organization(db, data["name"], now=now)
    uid = db.users.insert_one({
        "name": data["owner_name"], "email": email, "password_hash": generate_password_hash(data["owner_password"]),
        "role": "farm_owner", "org_id": org_id, "farm_ids": [], "active": True, "email_verified": True,
        "created_at": now, "updated_at": now, "deleted_at": None}).inserted_id
    db.organizations.update_one({"_id": org_id}, {"$set": {"owner_id": uid}})
    audit("create", "organizations", org_id)
    return ok(db.organizations.find_one({"_id": org_id}), status=201, message=f"Organization {data['name']} created")


@bp.patch("/<id_>")
@roles_required("super_admin")
def update_org(id_):
    db = get_db()
    data = {k: v for k, v in validate(OrgUpdateIn).items() if v is not None}
    if not data:
        raise ApiError("Nothing to update", 400)
    data["updated_at"] = datetime.utcnow()
    res = db.organizations.update_one({"_id": oid(id_), "deleted_at": None}, {"$set": data})
    if not res.matched_count:
        raise ApiError("Organization not found", 404)
    audit("update", "organizations", oid(id_), {k: v for k, v in data.items() if k != "updated_at"})
    msg = {"suspended": "Organization suspended. Its users can no longer sign in.",
           "active": "Organization reactivated"}.get(data.get("status"), "Organization updated")
    return ok(db.organizations.find_one({"_id": oid(id_)}), message=msg)
