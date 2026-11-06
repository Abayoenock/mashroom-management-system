import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


class Config:
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    MONGO_DB = os.getenv("MONGO_DB", "mycofarm")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-change-me-0123456789abcdef")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=int(os.getenv("JWT_ACCESS_MINUTES", "30")))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", "14")))
    CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
    JSON_SORT_KEYS = False
    SUPERADMIN_NAME = os.getenv("SUPERADMIN_NAME", "Platform Admin")
    SUPERADMIN_EMAIL = (os.getenv("SUPERADMIN_EMAIL") or "").strip().lower()
    SUPERADMIN_PASSWORD = os.getenv("SUPERADMIN_PASSWORD") or ""
    DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() in ("1", "true", "yes")
    DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "password123")
