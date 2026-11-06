from functools import wraps

from flask import g, request
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from ..extensions import get_db
from ..utils.responses_base import ApiError
from ..utils.serialize import oid

ROLES = ["super_admin", "farm_owner", "farm_manager", "farm_worker", "sales_manager"]
ADMINS = ("super_admin", "farm_owner")
MANAGERS = ("super_admin", "farm_owner", "farm_manager")
SALES = ("super_admin", "farm_owner", "sales_manager")


def current_user():
    if "user" not in g:
        verify_jwt_in_request()
        user = get_db().users.find_one({"_id": oid(get_jwt_identity()), "deleted_at": None})
        if not user or not user.get("active", True):
            raise ApiError("Account not found or disabled", 401)
        if user.get("org_id"):
            org = get_db().organizations.find_one({"_id": user["org_id"]}, {"status": 1})
            if not org or org.get("status") != "active":
                raise ApiError("Your organization's account is suspended. Contact the platform administrator.", 403)
        g.user = user
    return g.user


def roles_required(*roles):
    """Require an authenticated user; if roles are given the user must hold one of them."""

    def deco(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = current_user()
            if roles and user["role"] not in roles:
                raise ApiError("You do not have permission to perform this action", 403)
            return fn(*args, **kwargs)

        return wrapper

    return deco


def allowed_farm_ids():
    """None means unrestricted (super admin)."""
    user = current_user()
    if user["role"] == "super_admin":
        return None
    return list(user.get("farm_ids", []))


def farm_scope(field="farm_id"):
    """Mongo filter restricting documents to the farms this user may see.

    The optional X-Farm-Id header narrows the scope to one farm (if permitted)."""
    allowed = allowed_farm_ids()
    requested = request.headers.get("X-Farm-Id")
    if requested and requested != "all":
        fid = oid(requested, "farm")
        if allowed is not None and fid not in allowed:
            raise ApiError("You do not have access to this farm", 403)
        return {field: fid}
    if allowed is None:
        return {}
    return {field: {"$in": allowed}}


def assert_farm_access(farm_id):
    allowed = allowed_farm_ids()
    if allowed is not None and oid(farm_id, "farm_id") not in allowed:
        raise ApiError("You do not have access to this farm", 403)


# ------------------------------------------------------------------ tenancy
# Each organization (tenant) owns its farms, customers, varieties and users. Farm-level data (batches, harvests,
# stock, sales, expenses…) is isolated through farm_scope(), because a user's farm_ids only ever contain farms of
# their own organization. Super admins operate across all organizations.

def org_id():
    """The caller's organization id, or None for super admins."""
    user = current_user()
    return None if user["role"] == "super_admin" else user.get("org_id")


def org_scope(field="org_id"):
    """Mongo filter restricting org-level documents to the caller's organization.

    Super admins see everything, narrowed to one organization when a farm is selected in X-Farm-Id."""
    oid_ = org_id()
    if oid_ is not None:
        return {field: oid_}
    requested = request.headers.get("X-Farm-Id")
    if requested and requested != "all":
        farm = get_db().farms.find_one({"_id": oid(requested, "farm")}, {"org_id": 1})
        if farm:
            return {field: farm["org_id"]}
    return {}


def resolve_org_for_create(data=None):
    """Organization a new org-level document belongs to.

    Tenant users: always their own org (never trusted from the payload). Super admins: derived from the payload's
    farm_id, or from the farm selected in the top bar."""
    oid_ = org_id()
    if oid_ is not None:
        return oid_
    farm_id = (data or {}).get("farm_id") or request.headers.get("X-Farm-Id")
    if farm_id and farm_id != "all":
        farm = get_db().farms.find_one({"_id": oid(farm_id, "farm")}, {"org_id": 1})
        if farm:
            return farm["org_id"]
    raise ApiError("Select a farm in the top bar first, so the record is created for that organization", 400)


def assert_same_org(collection, doc_id, org, field):
    """Reject references to another tenant's documents (e.g. a sale using another org's customer)."""
    if doc_id is None:
        return
    q = {"_id": oid(doc_id, field), "deleted_at": None}
    if org is not None:
        q["org_id"] = org
    if not get_db()[collection].find_one(q, {"_id": 1}):
        raise ApiError("Referenced record not found", 422, {field: "Not found in this organization"})


def assert_same_farm(collection, doc_id, farm_id, field):
    if doc_id is None:
        return
    if not get_db()[collection].find_one({"_id": oid(doc_id, field), "farm_id": oid(farm_id), "deleted_at": None}, {"_id": 1}):
        raise ApiError("Referenced record must belong to the same farm", 422, {field: "Not on this farm"})


def farm_org(farm_id):
    farm = get_db().farms.find_one({"_id": oid(farm_id, "farm_id")}, {"org_id": 1})
    return farm and farm.get("org_id")
