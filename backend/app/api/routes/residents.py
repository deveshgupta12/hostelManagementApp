from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.feature_control import require_feature_enabled
from app.db.session import get_db
from app.models.feature_setting import FeatureName
from app.models.resident import Resident
from app.models.user import User, UserRole
from app.schemas.resident import ResidentDirectoryItem

router = APIRouter(prefix="/residents", tags=["Residents"])


@router.get("", response_model=list[ResidentDirectoryItem])
def get_resident_directory(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.WARDEN)),
) -> list[ResidentDirectoryItem]:
    # Resident directory access is controlled globally by Gate Access toggle.
    require_feature_enabled(db, FeatureName.GATE_ACCESS)

    residents = db.query(Resident).all()
    return [
        ResidentDirectoryItem(
            resident_id=resident.id,
            full_name=resident.user.full_name,
            room_number=resident.room.room_number,
            check_in_date=resident.check_in_date,
        )
        for resident in residents
    ]
