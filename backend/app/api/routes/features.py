from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.feature_setting import FeatureName, FeatureSetting
from app.models.user import User, UserRole
from app.schemas.feature import FeatureSettingResponse, FeatureUpdateRequest

router = APIRouter(prefix="/features", tags=["Feature Control"])


@router.get("", response_model=list[FeatureSettingResponse])
def list_feature_settings(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.WARDEN)),
) -> list[FeatureSettingResponse]:
    settings = db.query(FeatureSetting).all()
    return [FeatureSettingResponse(feature_name=item.feature_name, enabled=item.enabled) for item in settings]


@router.put("/{feature_name}", response_model=FeatureSettingResponse)
def update_feature_setting(
    feature_name: FeatureName,
    payload: FeatureUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
) -> FeatureSettingResponse:
    setting = db.query(FeatureSetting).filter(FeatureSetting.feature_name == feature_name).first()
    if setting is None:
        setting = FeatureSetting(feature_name=feature_name, enabled=payload.enabled, updated_by=current_user.id)
        db.add(setting)
    else:
        setting.enabled = payload.enabled
        setting.updated_by = current_user.id

    db.commit()
    db.refresh(setting)

    return FeatureSettingResponse(feature_name=setting.feature_name, enabled=setting.enabled)
