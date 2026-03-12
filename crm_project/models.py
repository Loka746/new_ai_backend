from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Float, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    SALES = "sales"
    MANAGER = "manager"

class DealStatus(str, enum.Enum):
    LEAD = "lead"
    QUALIFIED = "qualified"
    PROPOSAL = "proposal"
    NEGOTIATION = "negotiation"
    WON = "won"
    LOST = "lost"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    role = Column(String(50), default=UserRole.SALES.value)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    customers = relationship("Customer", back_populates="assigned_to_user")
    deals = relationship("Deal", back_populates="assigned_to_user")
    interactions = relationship("Interaction", back_populates="user")

    def __repr__(self):
        return f"<User {self.email}>"

class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(50), nullable=True)
    company = Column(String(255), nullable=True)
    industry = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    assigned_to_user = relationship("User", back_populates="customers")
    deals = relationship("Deal", back_populates="customer", cascade="all, delete-orphan")
    interactions = relationship("Interaction", back_populates="customer", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Customer {self.first_name} {self.last_name}>"

class Deal(Base):
    __tablename__ = "deals"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    value = Column(Float, nullable=False, default=0.0)
    status = Column(String(50), default=DealStatus.LEAD.value)
    expected_close_date = Column(DateTime(timezone=True), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    customer = relationship("Customer", back_populates="deals")
    assigned_to_user = relationship("User", back_populates="deals")
    interactions = relationship("Interaction", back_populates="deal", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Deal {self.title} - {self.value}>"

class Interaction(Base):
    __tablename__ = "interactions"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(50), nullable=False) # e.g., Call, Email, Meeting, Note
    notes = Column(Text, nullable=False)
    date = Column(DateTime(timezone=True), server_default=func.now())
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    deal_id = Column(Integer, ForeignKey("deals.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    customer = relationship("Customer", back_populates="interactions")
    deal = relationship("Deal", back_populates="interactions")
    user = relationship("User", back_populates="interactions")

    def __repr__(self):
        return f"<Interaction {self.type} - {self.date}>"
