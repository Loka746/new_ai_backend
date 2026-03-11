from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text, Enum, Float, Index
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from database import Base

class RoleEnum(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    USER = "user"

class LeadStatus(str, enum.Enum):
    NEW = "new"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    LOST = "lost"
    CONVERTED = "converted"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(RoleEnum), default=RoleEnum.USER, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    customers = relationship("Customer", back_populates="assigned_to_user")
    leads = relationship("Lead", back_populates="assigned_to_user")

class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(255), index=True, nullable=False)
    contact_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(50))
    address = Column(Text)
    industry = Column(String(100))
    annual_revenue = Column(Float, default=0.0)
    assigned_to = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    assigned_to_user = relationship("User", back_populates="customers")

class Lead(Base):
    __tablename__ = "leads"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    contact_name = Column(String(255), nullable=False)
    email = Column(String(255), index=True, nullable=False)
    phone = Column(String(50))
    status = Column(Enum(LeadStatus), default=LeadStatus.NEW, index=True)
    estimated_value = Column(Float, default=0.0)
    assigned_to = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    assigned_to_user = relationship("User", back_populates="leads")

Index('idx_customer_email', Customer.email)
Index('idx_lead_status', Lead.status)
