from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.feature_control import require_feature_enabled
from app.core.gst import calculate_indian_gst
from app.db.session import get_db
from app.models.feature_setting import FeatureName
from app.models.user import User, UserRole

router = APIRouter(prefix="/modules", tags=["Module APIs"])


class GstCalculatorRequest(BaseModel):
    daily_rent: float = Field(gt=0)
    days: int = Field(default=1, ge=1)
    is_long_term_residential: bool = True


@router.get("/mess/menu")
def mess_menu(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.WARDEN, UserRole.STUDENT)),
):
    require_feature_enabled(db, FeatureName.MESS)
    return {"items": ["Poha", "Dal", "Rice", "Chapati"]}


@router.post("/gate/checkin")
def gate_checkin(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.WARDEN, UserRole.STUDENT)),
):
    require_feature_enabled(db, FeatureName.GATE_ACCESS)
    return {"status": "checked_in", "module": "gate_access"}


@router.post("/gst/calculate")
def gst_calculator(
    payload: GstCalculatorRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.WARDEN)),
):
    require_feature_enabled(db, FeatureName.GST)
    return calculate_indian_gst(
        daily_rent=payload.daily_rent,
        days=payload.days,
        is_long_term_residential=payload.is_long_term_residential,
    )
