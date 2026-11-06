from flask_jwt_extended import JWTManager
from pymongo import MongoClient
from pymongo.database import Database

jwt = JWTManager()


class _Mongo:
    client: MongoClient | None = None
    db: Database | None = None

    def init_app(self, app):
        self.client = MongoClient(app.config["MONGO_URI"], tz_aware=False)
        self.db = self.client[app.config["MONGO_DB"]]


mongo = _Mongo()


def get_db() -> Database:
    assert mongo.db is not None, "Mongo not initialised"
    return mongo.db
