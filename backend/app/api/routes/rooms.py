from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.resident import Resident
from app.models.room import Room
from app.models.user import User, UserRole
from app.schemas.room import RoomCreateRequest, RoomResponse, RoomUpdateRequest

router = APIRouter(prefix="/rooms", tags=["Rooms"])


@router.get("", response_model=list[RoomResponse])
def list_rooms(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.WARDEN)),
) -> list[RoomResponse]:
    rooms = db.query(Room).filter(Room.is_active.is_(True)).order_by(Room.room_number.asc()).all()
    response: list[RoomResponse] = []

    for room in rooms:
        active_count = (
            db.query(Resident)
            .filter(Resident.room_id == room.id, Resident.check_out_date.is_(None))
            .count()
        )
        response.append(
            RoomResponse(
                id=room.id,
                room_number=room.room_number.strip(),
                capacity=room.capacity,
                daily_rent=float(room.daily_rent),
                active_residents=active_count,
            )
        )

    return response


@router.post("", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
def create_room(
    payload: RoomCreateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.OWNER)),
) -> RoomResponse:
    normalized_room_number = payload.room_number.strip()
    if not normalized_room_number:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Room number cannot be empty")

    existing_room = (
        db.query(Room)
        .filter(func.lower(func.trim(Room.room_number)) == normalized_room_number.lower())
        .first()
    )
    if existing_room:
        if existing_room.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Room number already exists")

        existing_room.is_active = True
        existing_room.capacity = payload.capacity
        existing_room.daily_rent = payload.daily_rent
        db.commit()
        db.refresh(existing_room)

        return RoomResponse(
            id=existing_room.id,
            room_number=existing_room.room_number.strip(),
            capacity=existing_room.capacity,
            daily_rent=float(existing_room.daily_rent),
            active_residents=0,
        )

    room = Room(
        room_number=normalized_room_number,
        capacity=payload.capacity,
        daily_rent=payload.daily_rent,
    )
    db.add(room)
    db.commit()
    db.refresh(room)

    return RoomResponse(
        id=room.id,
        room_number=room.room_number.strip(),
        capacity=room.capacity,
        daily_rent=float(room.daily_rent),
        active_residents=0,
    )


@router.put("/{room_id}", response_model=RoomResponse)
def update_room(
    room_id: int,
    payload: RoomUpdateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.OWNER)),
) -> RoomResponse:
    room = db.query(Room).filter(Room.id == room_id).first()
    if room is None or not room.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")

    normalized_room_number = payload.room_number.strip()
    if not normalized_room_number:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Room number cannot be empty")

    duplicate = (
        db.query(Room)
        .filter(
            func.lower(func.trim(Room.room_number)) == normalized_room_number.lower(),
            Room.id != room_id,
            Room.is_active.is_(True),
        )
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Room number already exists")

    active_count = (
        db.query(Resident)
        .filter(Resident.room_id == room.id, Resident.check_out_date.is_(None))
        .count()
    )
    if payload.capacity < active_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Capacity cannot be less than current active residents",
        )

    room.room_number = normalized_room_number
    room.capacity = payload.capacity
    room.daily_rent = payload.daily_rent
    db.commit()
    db.refresh(room)

    return RoomResponse(
        id=room.id,
        room_number=room.room_number.strip(),
        capacity=room.capacity,
        daily_rent=float(room.daily_rent),
        active_residents=active_count,
    )


@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_room(
    room_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.OWNER)),
) -> None:
    room = db.query(Room).filter(Room.id == room_id).first()
    if room is None or not room.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")

    active_count = (
        db.query(Resident)
        .filter(Resident.room_id == room.id, Resident.check_out_date.is_(None))
        .count()
    )
    if active_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete room with active residents",
        )

    room.is_active = False
    db.commit()
