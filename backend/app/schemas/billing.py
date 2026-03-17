from datetime import datetime

from pydantic import BaseModel, Field


class RentCollectionRequest(BaseModel):
    resident_id: int
    days: int | None = Field(default=None, ge=1)
    month: int | None = Field(default=None, ge=1, le=12)
    year: int | None = Field(default=None, ge=2000, le=2100)
    daily_rent: float | None = Field(default=None, gt=0)
    description: str | None = Field(default=None, max_length=255)


class TransactionResponse(BaseModel):
    id: int
    resident_id: int
    resident_name: str
    room_number: str
    description: str
    base_amount: float
    gst_rate: float
    gst_amount: float
    total_amount: float
    created_at: datetime


class ResidentLedgerResponse(BaseModel):
    resident_id: int
    resident_name: str
    room_number: str
    total_received: float
    entries: list[TransactionResponse]


class MonthlyCollectionResponse(BaseModel):
    year: int
    month: int
    total_received: float
    total_base_amount: float
    total_gst_collected: float
    transaction_count: int


class ReceiptResponse(BaseModel):
    receipt_number: str
    generated_at: datetime
    transaction: TransactionResponse
