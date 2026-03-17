from datetime import datetime
from calendar import monthrange

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.gst import calculate_indian_gst
from app.db.session import get_db
from app.models.resident import Resident
from app.models.transaction import Transaction
from app.models.user import User, UserRole
from app.schemas.billing import (
    MonthlyCollectionResponse,
    ReceiptResponse,
    RentCollectionRequest,
    ResidentLedgerResponse,
    TransactionResponse,
)

router = APIRouter(prefix="/billing", tags=["Billing"])


def _to_transaction_response(transaction: Transaction) -> TransactionResponse:
    return TransactionResponse(
        id=transaction.id,
        resident_id=transaction.resident_id,
        resident_name=transaction.resident.user.full_name,
        room_number=transaction.room.room_number,
        description=transaction.description,
        base_amount=float(transaction.base_amount),
        gst_rate=float(transaction.gst_rate),
        gst_amount=float(transaction.gst_amount),
        total_amount=float(transaction.total_amount),
        created_at=transaction.created_at,
    )


@router.post("/collect", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def collect_rent(
    payload: RentCollectionRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.WARDEN)),
) -> TransactionResponse:
    resident = db.query(Resident).filter(Resident.id == payload.resident_id).first()
    if resident is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resident not found")

    effective_year = payload.year if payload.year is not None else datetime.utcnow().year
    effective_month = payload.month if payload.month is not None else datetime.utcnow().month
    effective_days = payload.days if payload.days is not None else monthrange(effective_year, effective_month)[1]

    if payload.daily_rent is not None:
        effective_daily_rent = payload.daily_rent
        gst = calculate_indian_gst(
            daily_rent=effective_daily_rent,
            days=effective_days,
            is_long_term_residential=resident.is_long_term_residential,
        )
    elif resident.monthly_rent is not None:
        base_amount = float(resident.monthly_rent)
        daily_equivalent = base_amount / effective_days
        gst_preview = calculate_indian_gst(
            daily_rent=daily_equivalent,
            days=effective_days,
            is_long_term_residential=resident.is_long_term_residential,
        )
        gst_rate = gst_preview["gst_rate"]
        gst_amount = round(base_amount * gst_rate, 2)
        gst = {
            "base_amount": round(base_amount, 2),
            "gst_rate": gst_rate,
            "gst_amount": gst_amount,
            "total_amount": round(base_amount + gst_amount, 2),
        }
    else:
        effective_daily_rent = float(resident.room.daily_rent)
        gst = calculate_indian_gst(
            daily_rent=effective_daily_rent,
            days=effective_days,
            is_long_term_residential=resident.is_long_term_residential,
        )

    room_active_residents = (
        db.query(Resident)
        .filter(Resident.room_id == resident.room_id, Resident.check_out_date.is_(None))
        .count()
    )

    description = payload.description or (
        f"Monthly rent collection ({effective_month:02d}/{effective_year}, {effective_days} days, "
        f"room occupants: {room_active_residents})"
    )

    transaction = Transaction(
        resident_id=resident.id,
        room_id=resident.room_id,
        description=description,
        base_amount=gst["base_amount"],
        gst_rate=round(gst["gst_rate"] * 100, 2),
        gst_amount=gst["gst_amount"],
        total_amount=gst["total_amount"],
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)

    return _to_transaction_response(transaction)


@router.get("/residents/{resident_id}/ledger", response_model=ResidentLedgerResponse)
def get_resident_ledger(
    resident_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.WARDEN)),
) -> ResidentLedgerResponse:
    resident = db.query(Resident).filter(Resident.id == resident_id).first()
    if resident is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resident not found")

    transactions = (
        db.query(Transaction)
        .filter(Transaction.resident_id == resident.id)
        .order_by(Transaction.created_at.desc())
        .all()
    )

    total_received = sum(float(item.total_amount) for item in transactions)
    entries = [_to_transaction_response(item) for item in transactions]

    return ResidentLedgerResponse(
        resident_id=resident.id,
        resident_name=resident.user.full_name,
        room_number=resident.room.room_number,
        total_received=round(total_received, 2),
        entries=entries,
    )


@router.get("/monthly-summary", response_model=MonthlyCollectionResponse)
def get_monthly_collections(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.WARDEN)),
) -> MonthlyCollectionResponse:
    start_date = datetime(year, month, 1)
    end_date = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)

    transactions = (
        db.query(Transaction)
        .filter(and_(Transaction.created_at >= start_date, Transaction.created_at < end_date))
        .all()
    )

    total_received = sum(float(item.total_amount) for item in transactions)
    total_base = sum(float(item.base_amount) for item in transactions)
    total_gst = sum(float(item.gst_amount) for item in transactions)

    return MonthlyCollectionResponse(
        year=year,
        month=month,
        total_received=round(total_received, 2),
        total_base_amount=round(total_base, 2),
        total_gst_collected=round(total_gst, 2),
        transaction_count=len(transactions),
    )


@router.get("/transactions/{transaction_id}/receipt", response_model=ReceiptResponse)
def generate_receipt(
    transaction_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.WARDEN)),
) -> ReceiptResponse:
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    return ReceiptResponse(
        receipt_number=f"RCP-{transaction.id:06d}",
        generated_at=datetime.utcnow(),
        transaction=_to_transaction_response(transaction),
    )
