from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List
from datetime import datetime
from models import UserRole, DealStatus

# --- Token Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# --- User Schemas ---
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: Optional[str] = UserRole.SALES.value
    is_active: Optional[bool] = True

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class UserResponse(UserBase):
    id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True

# --- Customer Schemas ---
class CustomerBase(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None
    industry: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    assigned_to: Optional[int] = None

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    industry: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    assigned_to: Optional[int] = None

class CustomerResponse(CustomerBase):
    id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True

class PaginatedCustomerResponse(BaseModel):
    total: int
    items: List[CustomerResponse]

# --- Deal Schemas ---
class DealBase(BaseModel):
    title: str
    description: Optional[str] = None
    value: float = Field(default=0.0, ge=0.0)
    status: Optional[str] = DealStatus.LEAD.value
    expected_close_date: Optional[datetime] = None
    customer_id: int
    assigned_to: Optional[int] = None

class DealCreate(DealBase):
    pass

class DealUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    value: Optional[float] = None
    status: Optional[str] = None
    expected_close_date: Optional[datetime] = None
    customer_id: Optional[int] = None
    assigned_to: Optional[int] = None

class DealResponse(DealBase):
    id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    customer: Optional[CustomerResponse] = None

    class Config:
        orm_mode = True

class PaginatedDealResponse(BaseModel):
    total: int
    items: List[DealResponse]

# --- Interaction Schemas ---
class InteractionBase(BaseModel):
    type: str
    notes: str
    customer_id: int
    deal_id: Optional[int] = None

class InteractionCreate(InteractionBase):
    pass

class InteractionResponse(InteractionBase):
    id: int
    date: Optional[datetime]
    user_id: int
    created_at: Optional[datetime]

    class Config:
        orm_mode = True

class PaginatedInteractionResponse(BaseModel):
    total: int
    items: List[InteractionResponse]

# --- Dashboard Stats Schema ---
class DashboardStats(BaseModel):
    total_customers: int
    total_deals: int
    total_revenue: float
    deals_won: int
    recent_customers: List[CustomerResponse]
    recent_deals: List[DealResponse]
