from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from models import RoleEnum, LeadStatus

class UserBase(BaseModel):
    email: EmailStr
    full_name: str

class UserCreate(UserBase):
    password: str = Field(min_length=8)

class UserResponse(UserBase):
    id: int
    role: RoleEnum
    is_active: bool
    created_at: datetime
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class CustomerBase(BaseModel):
    company_name: str
    contact_name: str
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    industry: Optional[str] = None
    annual_revenue: Optional[float] = 0.0

class CustomerCreate(CustomerBase):
    assigned_to: Optional[int] = None

class CustomerUpdate(CustomerBase):
    pass

class CustomerResponse(CustomerBase):
    id: int
    assigned_to: Optional[int]
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class LeadBase(BaseModel):
    title: str
    contact_name: str
    email: EmailStr
    phone: Optional[str] = None
    status: LeadStatus = LeadStatus.NEW
    estimated_value: Optional[float] = 0.0

class LeadCreate(LeadBase):
    assigned_to: Optional[int] = None

class LeadUpdate(LeadBase):
    pass

class LeadResponse(LeadBase):
    id: int
    assigned_to: Optional[int]
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True
