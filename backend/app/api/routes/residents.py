from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.feature_control import require_feature_enabled
from app.core.security import get_password_hash
from app.db.session import get_db
from app.models.feature_setting import FeatureName
from app.models.resident import Resident
from app.models.room import Room
from app.models.transaction import Transaction
from app.models.user import User, UserRole
from app.schemas.resident import (
    ResidentCheckoutRequest,
    ResidentCreateRequest,
    ResidentDirectoryItem,
    ResidentManagementItem,
    ResidentUpdateRequest,
)

router = APIRouter(prefix="/residents", tags=["Residents"])


@router.get("", response_model=list[ResidentDirectoryItem])
def get_resident_directory(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.WARDEN)),
) -> list[ResidentDirectoryItem]:
    # Resident directory access is controlled globally by Gate Access toggle.
    require_feature_enabled(db, FeatureName.GATE_ACCESS)

    residents = db.query(Resident).filter(Resident.is_active.is_(True)).all()
    return [
        ResidentDirectoryItem(
            resident_id=resident.id,
            full_name=resident.user.full_name,
            room_number=resident.room.room_number,
            check_in_date=resident.check_in_date,
        )
        for resident in residents
    ]


@router.get("/manage", response_model=list[ResidentManagementItem])
def list_residents_for_management(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.WARDEN)),
) -> list[ResidentManagementItem]:
    today = date.today()
    residents = db.query(Resident).filter(Resident.is_active.is_(True)).all()
    response: list[ResidentManagementItem] = []

    for resident in residents:
        monthly_rent = float(resident.monthly_rent) if resident.monthly_rent is not None else 0.0
        current_month_collected = (
            db.query(func.coalesce(func.sum(Transaction.total_amount), 0))
            .filter(
                Transaction.resident_id == resident.id,
                extract("year", Transaction.created_at) == today.year,
                extract("month", Transaction.created_at) == today.month,
            )
            .scalar()
        )
        due_amount = max(monthly_rent - float(current_month_collected), 0.0)

        response.append(
            ResidentManagementItem(
                resident_id=resident.id,
                full_name=resident.user.full_name,
                email=resident.user.email,
                phone_number=resident.user.phone_number,
                parent_name=resident.parent_name,
                parent_phone_number=resident.parent_phone_number,
                room_id=resident.room_id,
                room_number=resident.room.room_number,
                monthly_rent=float(resident.monthly_rent) if resident.monthly_rent is not None else None,
                due_amount=due_amount,
                check_in_date=resident.check_in_date,
                check_out_date=resident.check_out_date,
                is_long_term_residential=resident.is_long_term_residential,
            )
        )

    return response


@router.post("", response_model=ResidentManagementItem, status_code=status.HTTP_201_CREATED)
def assign_resident(
    payload: ResidentCreateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.WARDEN)),
) -> ResidentManagementItem:
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")

    room = db.query(Room).filter(Room.id == payload.room_id, Room.is_active.is_(True)).first()
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")

    active_count = (
        db.query(Resident)
        .filter(Resident.room_id == room.id, Resident.check_out_date.is_(None), Resident.is_active.is_(True))
        .count()
    )
    if active_count >= room.capacity:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Room is already at full capacity")

    user = User(
        full_name=payload.full_name.strip(),
        email=payload.email,
        phone_number=payload.phone_number,
        password_hash=get_password_hash(payload.password),
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(user)
    db.flush()

    resident = Resident(
        user_id=user.id,
        room_id=payload.room_id,
        monthly_rent=payload.monthly_rent,
        parent_name=payload.parent_name.strip(),
        parent_phone_number=payload.parent_phone_number,
        check_in_date=payload.check_in_date,
        is_long_term_residential=payload.is_long_term_residential,
    )
    db.add(resident)
    db.commit()
    db.refresh(resident)

    return ResidentManagementItem(
        resident_id=resident.id,
        full_name=resident.user.full_name,
        email=resident.user.email,
        phone_number=resident.user.phone_number,
        parent_name=resident.parent_name,
        parent_phone_number=resident.parent_phone_number,
        room_id=resident.room_id,
        room_number=resident.room.room_number,
        monthly_rent=float(resident.monthly_rent) if resident.monthly_rent is not None else None,
        due_amount=float(resident.monthly_rent) if resident.monthly_rent is not None else 0.0,
        check_in_date=resident.check_in_date,
        check_out_date=resident.check_out_date,
        is_long_term_residential=resident.is_long_term_residential,
    )


@router.put("/{resident_id}", response_model=ResidentManagementItem)
def update_resident(
    resident_id: int,
    payload: ResidentUpdateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.WARDEN)),
) -> ResidentManagementItem:
    resident = db.query(Resident).filter(Resident.id == resident_id, Resident.is_active.is_(True)).first()
    if resident is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resident not found")

    room = db.query(Room).filter(Room.id == payload.room_id, Room.is_active.is_(True)).first()
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")

    duplicate_user = (
        db.query(User)
        .filter(User.email == payload.email, User.id != resident.user_id)
        .first()
    )
    if duplicate_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")

    if payload.room_id != resident.room_id:
        active_count = (
            db.query(Resident)
            .filter(Resident.room_id == payload.room_id, Resident.check_out_date.is_(None), Resident.is_active.is_(True))
            .count()
        )
        if active_count >= room.capacity:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Target room is already at full capacity")

    resident.user.full_name = payload.full_name.strip()
    resident.user.email = payload.email
    resident.user.phone_number = payload.phone_number
    resident.parent_name = payload.parent_name.strip()
    resident.parent_phone_number = payload.parent_phone_number
    resident.room_id = payload.room_id
    resident.monthly_rent = payload.monthly_rent
    resident.check_in_date = payload.check_in_date
    resident.check_out_date = payload.check_out_date
    resident.is_long_term_residential = payload.is_long_term_residential

    db.commit()
    db.refresh(resident)

    return ResidentManagementItem(
        resident_id=resident.id,
        full_name=resident.user.full_name,
        email=resident.user.email,
        phone_number=resident.user.phone_number,
        parent_name=resident.parent_name,
        parent_phone_number=resident.parent_phone_number,
        room_id=resident.room_id,
        room_number=resident.room.room_number,
        monthly_rent=float(resident.monthly_rent) if resident.monthly_rent is not None else None,
        due_amount=float(resident.monthly_rent) if resident.monthly_rent is not None else 0.0,
        check_in_date=resident.check_in_date,
        check_out_date=resident.check_out_date,
        is_long_term_residential=resident.is_long_term_residential,
    )


@router.post("/{resident_id}/checkout", response_model=ResidentManagementItem)
def checkout_resident(
    resident_id: int,
    payload: ResidentCheckoutRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.WARDEN)),
) -> ResidentManagementItem:
    resident = db.query(Resident).filter(Resident.id == resident_id, Resident.is_active.is_(True)).first()
    if resident is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resident not found")

    if resident.check_out_date is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Resident is already checked out")

    check_out_date = payload.check_out_date or date.today()
    if check_out_date < resident.check_in_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Check-out date cannot be before check-in")

    resident.check_out_date = check_out_date
    db.commit()
    db.refresh(resident)

    return ResidentManagementItem(
        resident_id=resident.id,
        full_name=resident.user.full_name,
        email=resident.user.email,
        phone_number=resident.user.phone_number,
        parent_name=resident.parent_name,
        parent_phone_number=resident.parent_phone_number,
        room_id=resident.room_id,
        room_number=resident.room.room_number,
        monthly_rent=float(resident.monthly_rent) if resident.monthly_rent is not None else None,
        due_amount=float(resident.monthly_rent) if resident.monthly_rent is not None else 0.0,
        check_in_date=resident.check_in_date,
        check_out_date=resident.check_out_date,
        is_long_term_residential=resident.is_long_term_residential,
    )


@router.delete("/{resident_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_past_resident(
    resident_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.WARDEN)),
) -> None:
    resident = db.query(Resident).filter(Resident.id == resident_id, Resident.is_active.is_(True)).first()
    if resident is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resident not found")

    if resident.check_out_date is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only past residents can be deleted")

    resident.is_active = False
    resident.user.is_active = False
    db.commit()
