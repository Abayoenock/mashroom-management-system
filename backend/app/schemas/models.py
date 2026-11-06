"""Request payload validation (pydantic v2)."""
from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator  # noqa: F401

Str = Field(min_length=1, max_length=200)


class Base(BaseModel):
    model_config = {"extra": "ignore", "str_strip_whitespace": True}


class RegisterIn(Base):
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8, max_length=128)
    farm_name: Optional[str] = Field(default=None, max_length=100)


class LoginIn(Base):
    email: str
    password: str


class UserIn(Base):
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    role: Literal["super_admin", "farm_owner", "farm_manager", "farm_worker", "sales_manager"]
    farm_ids: list[str] = []
    active: bool = True
    password: Optional[str] = Field(default=None, min_length=8)


class ProfileIn(Base):
    name: str = Field(min_length=2, max_length=100)
    phone: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = Field(default=None, min_length=8)


class FarmIn(Base):
    name: str = Str
    code: str = Field(min_length=2, max_length=20)
    location: str = Str
    description: Optional[str] = ""
    size_sqm: float = Field(ge=0)
    manager: Optional[str] = ""
    contact_phone: Optional[str] = ""
    contact_email: Optional[str] = ""
    status: Literal["active", "inactive", "maintenance"] = "active"


class RoomIn(Base):
    farm_id: str
    name: str = Str
    code: str = Field(min_length=1, max_length=20)
    capacity_bags: int = Field(ge=0)
    variety_id: Optional[str] = None
    temperature: float = Field(ge=-10, le=60)
    humidity: float = Field(ge=0, le=100)
    ventilation: Literal["on", "off", "auto"] = "auto"
    status: Literal["active", "idle", "cleaning", "maintenance"] = "active"


class VarietyIn(Base):
    name: str = Str
    scientific_name: str = Str
    description: Optional[str] = ""
    incubation_days: int = Field(ge=1, le=365)
    fruiting_days: int = Field(ge=1, le=365)
    expected_yield_kg_per_bag: float = Field(gt=0)
    temp_min: float
    temp_max: float
    humidity_min: float = Field(ge=0, le=100)
    humidity_max: float = Field(ge=0, le=100)
    price_per_kg: float = Field(ge=0)
    color: Optional[str] = None


STAGES = [
    "substrate_preparation", "sterilization", "spawning", "incubation",
    "pinning", "fruiting", "harvesting", "completed",
]
Stage = Literal[
    "substrate_preparation", "sterilization", "spawning", "incubation",
    "pinning", "fruiting", "harvesting", "completed",
]


class BatchIn(Base):
    variety_id: str
    farm_id: str
    room_id: str
    substrate_type: str = Str
    substrate_prep_date: date
    spawning_date: date
    bags: int = Field(ge=1)
    substrate_kg: float = Field(ge=0)
    spawn_kg: float = Field(ge=0)
    worker: Optional[str] = ""
    notes: Optional[str] = ""


class StageIn(Base):
    stage: Stage
    notes: Optional[str] = ""


class ObservationIn(Base):
    date: date
    temperature: float
    humidity: float = Field(ge=0, le=100)
    condition: Literal["excellent", "good", "fair", "poor"]
    contamination: bool = False
    affected_bags: int = Field(ge=0, default=0)
    notes: Optional[str] = ""


class HarvestIn(Base):
    batch_id: str
    date: date
    flush: int = Field(ge=1, le=10)
    bags_harvested: int = Field(ge=1)
    weight_kg: float = Field(gt=0)
    grade: Literal["A", "B", "C"]
    rejected_kg: float = Field(ge=0, default=0)
    worker: Optional[str] = ""
    notes: Optional[str] = ""


class ApproveIn(Base):
    action: Literal["approve", "reject"] = "approve"
    storage_location: Optional[str] = "Cold Room 1"
    shelf_life_days: int = Field(default=7, ge=1, le=60)
    notes: Optional[str] = ""


INV_CATEGORIES = Literal["substrate", "spawn", "bags", "packaging", "cleaning", "other"]


class InventoryItemIn(Base):
    farm_id: str
    name: str = Str
    sku: str = Field(min_length=1, max_length=40)
    category: INV_CATEGORIES
    unit: str = Field(min_length=1, max_length=20)
    quantity: float = Field(ge=0)
    min_level: float = Field(ge=0)
    unit_cost: float = Field(ge=0, default=0)
    location: Optional[str] = ""
    expiry_date: Optional[date] = None


class InvTxnIn(Base):
    item_id: Optional[str] = None
    lot_id: Optional[str] = None
    type: Literal["received", "consumed", "adjustment", "damaged", "expired"]
    quantity: float = Field(gt=0)
    direction: Literal["in", "out"] = "in"
    notes: Optional[str] = ""


class CustomerIn(Base):
    name: str = Str
    type: Literal["individual", "retailer", "wholesaler", "restaurant", "distributor"]
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    status: Literal["active", "inactive"] = "active"
    notes: Optional[str] = ""


class SaleLineIn(Base):
    variety_id: str
    quantity_kg: float = Field(gt=0)
    unit_price: float = Field(ge=0)
    grade: Optional[Literal["A", "B", "C"]] = None


class SaleIn(Base):
    customer_id: str
    farm_id: str
    date: date
    items: list[SaleLineIn] = Field(min_length=1)
    discount: float = Field(ge=0, default=0)
    payment_method: Literal["cash", "mobile_money", "bank_transfer", "card", "credit"]
    amount_paid: float = Field(ge=0, default=0)
    notes: Optional[str] = ""


class SaleStatusIn(Base):
    delivery_status: Optional[Literal["pending", "dispatched", "delivered"]] = None
    status: Optional[Literal["confirmed", "cancelled", "returned"]] = None


class PaymentIn(Base):
    amount: float = Field(gt=0)
    method: Literal["cash", "mobile_money", "bank_transfer", "card"]
    notes: Optional[str] = ""


EXP_CATS = Literal[
    "spawn", "substrate", "labor", "electricity", "water", "packaging",
    "transportation", "equipment", "maintenance", "other",
]


class ExpenseIn(Base):
    farm_id: str
    description: str = Str
    category: EXP_CATS
    amount: float = Field(gt=0)
    date: date
    payment_method: Literal["cash", "mobile_money", "bank_transfer", "card"]
    responsible: Optional[str] = ""
    batch_id: Optional[str] = None


class EmployeeIn(Base):
    farm_id: str
    name: str = Str
    position: str = Str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    room_id: Optional[str] = None
    status: Literal["active", "on_leave", "terminated"] = "active"
    hired_on: Optional[date] = None


class TaskIn(Base):
    farm_id: str
    title: str = Str
    description: Optional[str] = ""
    employee_id: Optional[str] = None
    room_id: Optional[str] = None
    due_date: date
    priority: Literal["low", "medium", "high"] = "medium"
    status: Literal["todo", "in_progress", "done"] = "todo"
