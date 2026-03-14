from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.feature_setting import FeatureName, FeatureSetting


def is_feature_enabled(db: Session, feature_name: FeatureName) -> bool:
    setting = db.query(FeatureSetting).filter(FeatureSetting.feature_name == feature_name).first()
    return bool(setting and setting.enabled)


def require_feature_enabled(db: Session, feature_name: FeatureName) -> None:
    if not is_feature_enabled(db, feature_name):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Feature '{feature_name.value}' is currently disabled by Super Admin",
        )
