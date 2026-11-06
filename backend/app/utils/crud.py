"""Small generic CRUD factory used by most resource blueprints."""
from datetime import datetime

from flask import request
from pydantic import ValidationError

from ..extensions import get_db
from ..permissions.rbac import (assert_farm_access, assert_same_farm, assert_same_org, farm_org, farm_scope, org_scope,
                                resolve_org_for_create, roles_required)
from .audit import audit
from .pagination import paginate
from .responses import ok
from .responses_base import ApiError
from .serialize import oid, to_mongo


def validate(model, data=None):
    try:
        obj = model.model_validate(data if data is not None else (request.get_json(silent=True) or {}))
    except ValidationError as e:
        errors = {".".join(str(p) for p in er["loc"]): er["msg"] for er in e.errors()}
        raise ApiError("Validation failed", 422, errors)
    return to_mongo(obj.model_dump())


def attach(items, field, coll, as_, proj="name"):
    """Add a display field (e.g. farm_name) for referenced ids."""
    ids = {it.get(field) for it in items if it.get(field)}
    if not ids:
        return items
    lookup = {d["_id"]: d.get(proj) for d in get_db()[coll].find({"_id": {"$in": list(ids)}}, {proj: 1})}
    for it in items:
        it[as_] = lookup.get(it.get(field))
    return items


def crud(bp, path, coll_name, model, *, read_roles=(), write_roles=(), delete_roles=None,
         search=(), filters=(), scope_kind="farm", enrich=None, unique=None, sort="created_at", after_create=None, refs=None):
    """scope_kind: "farm" - documents carry farm_id and are isolated by the user's farms;
              "org"  - org-level documents (customers, varieties) isolated by org_id;
              "farms" - the farms collection itself (isolated by _id, stamped with org_id).
    refs: {field: (collection, "org" | "farm")} - referenced ids must belong to the same org / farm."""
    delete_roles = delete_roles or write_roles
    refs = refs or {}

    def coll():
        return get_db()[coll_name]

    def scope():
        if scope_kind == "org":
            return org_scope()
        return farm_scope("_id" if scope_kind == "farms" else "farm_id")

    def doc_org(data):
        if scope_kind == "farm":
            return farm_org(data["farm_id"])
        return data.get("org_id")

    def check_refs(data):
        org = doc_org(data)
        for field, (ref_coll, kind) in refs.items():
            if not data.get(field):
                continue
            if kind == "farm":
                assert_same_farm(ref_coll, data[field], data["farm_id"], field)
            else:
                assert_same_org(ref_coll, data[field], org, field)

    def find_or_404(id_):
        doc = coll().find_one({"_id": oid(id_), "deleted_at": None, **scope()})
        if not doc:
            raise ApiError("Not found", 404)
        return doc

    def check_unique(data, exclude=None):
        if not unique:
            return
        # unique within the tenant (two organizations may both have a farm coded "F01")
        q = {unique: data[unique], "deleted_at": None}
        if data.get("org_id"):
            q["org_id"] = data["org_id"]
        if exclude:
            q["_id"] = {"$ne": exclude}
        if coll().find_one(q):
            raise ApiError(f"{unique.replace('_', ' ').title()} already exists", 409, {unique: "Already exists"})

    @roles_required(*read_roles)
    def list_():
        items, meta = paginate(coll(), scope(), search, filters, default_sort=sort)
        if enrich:
            enrich(items)
        return ok(items, meta)

    @roles_required(*write_roles)
    def create():
        data = validate(model)
        if scope_kind == "farm":
            assert_farm_access(data["farm_id"])
        else:
            data["org_id"] = resolve_org_for_create(data)
        check_refs(data)
        check_unique(data)
        now = datetime.utcnow()
        data.update(created_at=now, updated_at=now, deleted_at=None)
        res = coll().insert_one(data)
        audit("create", coll_name, res.inserted_id)
        if after_create:
            after_create(res.inserted_id, data)
        return ok(coll().find_one({"_id": res.inserted_id}), status=201, message="Created")

    @roles_required(*read_roles)
    def get_one(id_):
        doc = find_or_404(id_)
        if enrich:
            enrich([doc])
        return ok(doc)

    @roles_required(*write_roles)
    def update(id_):
        doc = find_or_404(id_)
        data = validate(model)
        if scope_kind == "farm":
            assert_farm_access(data["farm_id"])
        else:
            data["org_id"] = doc.get("org_id")  # a record never moves between tenants
        check_refs(data)
        check_unique(data, doc["_id"])
        data["updated_at"] = datetime.utcnow()
        coll().update_one({"_id": doc["_id"]}, {"$set": data})
        audit("update", coll_name, doc["_id"])
        return ok(coll().find_one({"_id": doc["_id"]}), message="Updated")

    @roles_required(*delete_roles)
    def delete(id_):
        doc = find_or_404(id_)
        coll().update_one({"_id": doc["_id"]}, {"$set": {"deleted_at": datetime.utcnow()}})
        audit("delete", coll_name, doc["_id"])
        return ok({"id": str(doc["_id"])}, message="Deleted")

    name = path.strip("/").replace("/", "_")
    bp.add_url_rule(path, f"{name}_list", list_, methods=["GET"])
    bp.add_url_rule(path, f"{name}_create", create, methods=["POST"])
    bp.add_url_rule(f"{path}/<id_>", f"{name}_get", get_one, methods=["GET"])
    bp.add_url_rule(f"{path}/<id_>", f"{name}_update", update, methods=["PUT"])
    bp.add_url_rule(f"{path}/<id_>", f"{name}_delete", delete, methods=["DELETE"])
    return find_or_404
