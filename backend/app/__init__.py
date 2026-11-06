from flask import Flask
from flask_cors import CORS
from pydantic import ValidationError
from werkzeug.exceptions import HTTPException

from .config import Config
from .extensions import get_db, jwt, mongo
from .utils.responses import err
from .utils.responses_base import ApiError


def create_app(config=Config):
    app = Flask(__name__)
    app.config.from_object(config)
    app.json.sort_keys = False

    CORS(app, origins=app.config["CORS_ORIGINS"], supports_credentials=True,
         allow_headers=["Authorization", "Content-Type", "X-Farm-Id"])
    mongo.init_app(app)
    jwt.init_app(app)

    from .db.indexes import ensure_indexes
    ensure_indexes(get_db())
    from .db.bootstrap import ensure_superadmin
    ensure_superadmin(get_db(), app.config, app.logger)

    @jwt.token_in_blocklist_loader
    def is_revoked(_header, payload):
        return get_db().token_blocklist.find_one({"jti": payload["jti"]}) is not None

    @jwt.expired_token_loader
    def expired(_h, _p):
        return err("Token has expired", 401)

    @jwt.invalid_token_loader
    def invalid(reason):
        return err(f"Invalid token: {reason}", 401)

    @jwt.unauthorized_loader
    def missing(reason):
        return err("Authentication required", 401)

    @jwt.revoked_token_loader
    def revoked(_h, _p):
        return err("Token has been revoked", 401)

    @app.errorhandler(ApiError)
    def api_error(e):
        return err(e.message, e.status, e.errors)

    @app.errorhandler(ValidationError)
    def validation_error(e):
        return err("Validation failed", 422, {".".join(map(str, x["loc"])): x["msg"] for x in e.errors()})

    @app.errorhandler(HTTPException)
    def http_error(e):
        return err(e.description or e.name, e.code)

    @app.errorhandler(Exception)
    def unhandled(e):
        app.logger.exception(e)
        return err("Internal server error", 500)

    from .routes import auth, dashboard, farms, harvests, inventory, misc, organizations, production, sales, users
    for mod in (auth, users, organizations, farms, production, harvests, inventory, sales, dashboard, misc):
        app.register_blueprint(mod.bp)

    @app.get("/api/v1/health")
    def health():
        get_db().command("ping")
        return {"success": True, "status": "ok"}

    return app
