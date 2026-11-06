from flask import jsonify
from .serialize import to_json


def ok(data=None, meta=None, status=200, message=None):
    body = {"success": True, "data": to_json(data)}
    if meta is not None:
        body["meta"] = meta
    if message:
        body["message"] = message
    return jsonify(body), status


def err(message, status=400, errors=None):
    body = {"success": False, "message": message}
    if errors:
        body["errors"] = errors
    return jsonify(body), status


from .responses_base import ApiError  # noqa: E402,F401
