import secrets
from datetime import datetime, timedelta

from flask import Blueprint
from flask_jwt_extended import (create_access_token, create_refresh_token, get_jwt,
                                get_jwt_identity, jwt_required)
from werkzeug.security import check_password_hash, generate_password_hash

from ..db.defaults import create_organization
from ..extensions import get_db
from ..permissions.rbac import current_user, roles_required
from ..schemas.models import Base, LoginIn, ProfileIn, RegisterIn
from ..utils.audit import audit
from ..utils.crud import validate
from ..utils.responses import ok
from ..utils.responses_base import ApiError
from ..utils.serialize import oid

bp = Blueprint("auth", __name__, url_prefix="/api/v1/auth")


class ForgotIn(Base):
    email: str


class ResetIn(Base):
    token: str
    password: str


class VerifyIn(Base):
    token: str


def public_user(u):
    db = get_db()
    farms = list(db.farms.find(
        {"deleted_at": None} if u["role"] == "super_admin" else {"_id": {"$in": u.get("farm_ids", [])}, "deleted_at": None},
        {"name": 1, "code": 1, "org_id": 1},
    ).sort("name", 1))
    orgs = {o["_id"]: o["name"] for o in db.organizations.find({"_id": {"$in": [f.get("org_id") for f in farms]}}, {"name": 1})}
    for f in farms:
        f["org_name"] = orgs.get(f.get("org_id"))
    org = db.organizations.find_one({"_id": u.get("org_id")}, {"name": 1, "status": 1}) if u.get("org_id") else None
    return {
        "_id": u["_id"], "name": u["name"], "email": u["email"], "role": u["role"],
        "phone": u.get("phone"), "email_verified": u.get("email_verified", False),
        "organization": org, "farms": farms, "created_at": u.get("created_at"),
    }


def issue_tokens(u):
    claims = {"role": u["role"]}
    return {
        "access_token": create_access_token(identity=str(u["_id"]), additional_claims=claims),
        "refresh_token": create_refresh_token(identity=str(u["_id"]), additional_claims=claims),
    }


@bp.post("/register")
def register():
    data = validate(RegisterIn)
    db = get_db()
    email = data["email"].lower()
    if db.users.find_one({"email": email}):
        raise ApiError("An account with this email already exists", 409, {"email": "Already registered"})
    now = datetime.utcnow()
    # every self-registration is a new, isolated tenant (organization) owned by this user
    org_name = data.get("farm_name") or f"{data['name']}'s Farm"
    org_id, _ = create_organization(db, org_name, now=now)
    farm_ids = []
    if data.get("farm_name"):
        code = "".join(w[0] for w in data["farm_name"].split()[:3]).upper() + str(secrets.randbelow(900) + 100)
        fid = db.farms.insert_one({"org_id": org_id,
            "name": data["farm_name"], "code": code, "location": "", "description": "", "size_sqm": 0,
            "manager": data["name"], "contact_phone": "", "contact_email": email, "status": "active",
            "created_at": now, "updated_at": now, "deleted_at": None,
        }).inserted_id
        farm_ids.append(fid)
    user = {
        "name": data["name"], "email": email, "password_hash": generate_password_hash(data["password"]),
        "role": "farm_owner", "org_id": org_id, "farm_ids": farm_ids, "active": True, "email_verified": False,
        "verify_token": secrets.token_urlsafe(24), "created_at": now, "updated_at": now, "deleted_at": None,
    }
    user["_id"] = db.users.insert_one(user).inserted_id
    db.organizations.update_one({"_id": org_id}, {"$set": {"owner_id": user["_id"]}})
    return ok({"user": public_user(user), **issue_tokens(user), "dev_verify_token": user["verify_token"]}, status=201,
              message="Account created")


@bp.post("/login")
def login():
    data = validate(LoginIn)
    u = get_db().users.find_one({"email": data["email"].lower().strip(), "deleted_at": None})
    if not u or not check_password_hash(u["password_hash"], data["password"]):
        raise ApiError("Invalid email or password", 401)
    if not u.get("active", True):
        raise ApiError("This account has been disabled", 403)
    if u.get("org_id"):
        org = get_db().organizations.find_one({"_id": u["org_id"]}, {"status": 1})
        if not org or org.get("status") != "active":
            raise ApiError("Your organization's account is suspended. Contact the platform administrator.", 403)
    get_db().users.update_one({"_id": u["_id"]}, {"$set": {"last_login": datetime.utcnow()}})
    return ok({"user": public_user(u), **issue_tokens(u)})


@bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    # rotate: revoke the presented refresh token and issue a new pair
    jwt_data = get_jwt()
    get_db().token_blocklist.insert_one({"jti": jwt_data["jti"], "created_at": datetime.utcnow()})
    u = get_db().users.find_one({"_id": oid(get_jwt_identity()), "deleted_at": None})
    if not u or not u.get("active", True):
        raise ApiError("Account not found", 401)
    return ok(issue_tokens(u))


@bp.post("/logout")
@jwt_required(verify_type=False)
def logout():
    get_db().token_blocklist.insert_one({"jti": get_jwt()["jti"], "created_at": datetime.utcnow()})
    return ok(message="Logged out")


@bp.get("/me")
@roles_required()
def me():
    return ok(public_user(current_user()))


@bp.put("/me")
@roles_required()
def update_me():
    data = validate(ProfileIn)
    u = current_user()
    upd = {"name": data["name"], "phone": data.get("phone"), "updated_at": datetime.utcnow()}
    if data.get("new_password"):
        if not data.get("current_password") or not check_password_hash(u["password_hash"], data["current_password"]):
            raise ApiError("Current password is incorrect", 400, {"current_password": "Incorrect"})
        upd["password_hash"] = generate_password_hash(data["new_password"])
    get_db().users.update_one({"_id": u["_id"]}, {"$set": upd})
    audit("update_profile", "users", u["_id"])
    return ok(public_user(get_db().users.find_one({"_id": u["_id"]})), message="Profile updated")


@bp.post("/forgot-password")
def forgot():
    data = validate(ForgotIn)
    u = get_db().users.find_one({"email": data["email"].lower(), "deleted_at": None})
    payload = {}
    if u:
        token = secrets.token_urlsafe(24)
        get_db().users.update_one({"_id": u["_id"]}, {"$set": {
            "reset_token": token, "reset_expires": datetime.utcnow() + timedelta(hours=1)}})
        payload["dev_reset_token"] = token  # no mail server in the prototype
    return ok(payload, message="If the email exists, a reset link has been sent")


@bp.post("/reset-password")
def reset():
    data = validate(ResetIn)
    if len(data["password"]) < 8:
        raise ApiError("Password must be at least 8 characters", 422, {"password": "Too short"})
    u = get_db().users.find_one({"reset_token": data["token"], "reset_expires": {"$gt": datetime.utcnow()}})
    if not u:
        raise ApiError("Reset link is invalid or has expired", 400)
    get_db().users.update_one({"_id": u["_id"]}, {
        "$set": {"password_hash": generate_password_hash(data["password"])},
        "$unset": {"reset_token": "", "reset_expires": ""}})
    return ok(message="Password updated, you can now sign in")


@bp.post("/verify-email")
def verify_email():
    data = validate(VerifyIn)
    res = get_db().users.update_one({"verify_token": data["token"]},
                                    {"$set": {"email_verified": True}, "$unset": {"verify_token": ""}})
    if not res.matched_count:
        raise ApiError("Verification link is invalid", 400)
    return ok(message="Email verified")
