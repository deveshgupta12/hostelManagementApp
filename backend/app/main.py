from fastapi import FastAPI

from app.api.routes import auth, features, modules, residents
from app.core.config import settings
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.feature_setting import FeatureName, FeatureSetting
from app.models.user import User, UserRole

# Ensure model metadata is registered before table creation.
from app import models as _models  # noqa: F401

app = FastAPI(title=settings.app_name, version="1.0.0")


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        for feature in FeatureName:
            exists = db.query(FeatureSetting).filter(FeatureSetting.feature_name == feature).first()
            if not exists:
                db.add(FeatureSetting(feature_name=feature, enabled=True))
        db.commit()

        has_super_admin = db.query(User).filter(User.role == UserRole.SUPER_ADMIN).first()
        if not has_super_admin:
            # Seed-only placeholder account hash; replace in production via admin flow.
            db.add(
                User(
                    full_name="Super Admin",
                    email="superadmin@hostelhub.in",
                    password_hash="$2b$12$6jcw91a2AA6fNfX6ESp2POb6QfMV6j08cA0xSiKf4V4mL5e8hqo9G",
                    role=UserRole.SUPER_ADMIN,
                    is_active=True,
                )
            )
            db.commit()
    finally:
        db.close()


@app.get("/")
def healthcheck() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}


app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(features.router, prefix=settings.api_v1_prefix)
app.include_router(residents.router, prefix=settings.api_v1_prefix)
app.include_router(modules.router, prefix=settings.api_v1_prefix)
