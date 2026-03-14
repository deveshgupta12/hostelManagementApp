from pydantic import BaseModel

from app.models.feature_setting import FeatureName


class FeatureSettingResponse(BaseModel):
    feature_name: FeatureName
    enabled: bool


class FeatureUpdateRequest(BaseModel):
    enabled: bool
