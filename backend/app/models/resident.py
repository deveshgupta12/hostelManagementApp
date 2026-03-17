from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.room import Room
    from app.models.transaction import Transaction
    from app.models.user import User


class Resident(Base):
    __tablename__ = "residents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), nullable=False)
    monthly_rent: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    parent_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    parent_phone_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    check_in_date: Mapped[date] = mapped_column(Date, nullable=False)
    check_out_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_long_term_residential: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="residents")
    room: Mapped["Room"] = relationship("Room", back_populates="residents")
    transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="resident")
