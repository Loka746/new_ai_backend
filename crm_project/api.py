from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import logging
from database import get_db
from models import Customer, Lead, User, RoleEnum
from schemas import CustomerCreate, CustomerUpdate, CustomerResponse, LeadCreate, LeadUpdate, LeadResponse
from auth import get_current_user, require_role

logger = logging.getLogger(__name__)
router = APIRouter()

# --- CUSTOMERS ---
@router.post("/customers", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(customer: CustomerCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        db_customer = Customer(**customer.model_dump())
        if not db_customer.assigned_to:
            db_customer.assigned_to = current_user.id
        db.add(db_customer)
        db.commit()
        db.refresh(db_customer)
        return db_customer
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating customer: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create customer")

@router.get("/customers", response_model=List[CustomerResponse])
def get_customers(skip: int = 0, limit: int = 100, search: str = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        query = db.query(Customer)
        if search:
            query = query.filter(Customer.company_name.ilike(f"%{search}%") | Customer.email.ilike(f"%{search}%"))
        if current_user.role == RoleEnum.USER:
            query = query.filter(Customer.assigned_to == current_user.id)
        return query.offset(skip).limit(limit).all()
    except Exception as e:
        logger.error(f"Error fetching customers: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to fetch customers")

@router.get("/customers/{customer_id}", response_model=CustomerResponse)
def get_customer(customer_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if not customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
        if current_user.role == RoleEnum.USER and customer.assigned_to != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this customer")
        return customer
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching customer {customer_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")

@router.put("/customers/{customer_id}", response_model=CustomerResponse)
def update_customer(customer_id: int, customer_update: CustomerUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        db_customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if not db_customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
        if current_user.role == RoleEnum.USER and db_customer.assigned_to != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this customer")
        
        for key, value in customer_update.model_dump(exclude_unset=True).items():
            setattr(db_customer, key, value)
        
        db.commit()
        db.refresh(db_customer)
        return db_customer
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating customer {customer_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update customer")

@router.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(customer_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.MANAGER]))):
    try:
        db_customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if not db_customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
        db.delete(db_customer)
        db.commit()
        return None
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting customer {customer_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete customer")

# --- LEADS ---
@router.post("/leads", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
def create_lead(lead: LeadCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        db_lead = Lead(**lead.model_dump())
        if not db_lead.assigned_to:
            db_lead.assigned_to = current_user.id
        db.add(db_lead)
        db.commit()
        db.refresh(db_lead)
        return db_lead
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating lead: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create lead")

@router.get("/leads", response_model=List[LeadResponse])
def get_leads(skip: int = 0, limit: int = 100, status_filter: str = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        query = db.query(Lead)
        if status_filter:
            query = query.filter(Lead.status == status_filter)
        if current_user.role == RoleEnum.USER:
            query = query.filter(Lead.assigned_to == current_user.id)
        return query.offset(skip).limit(limit).all()
    except Exception as e:
        logger.error(f"Error fetching leads: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to fetch leads")

@router.put("/leads/{lead_id}", response_model=LeadResponse)
def update_lead(lead_id: int, lead_update: LeadUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        db_lead = db.query(Lead).filter(Lead.id == lead_id).first()
        if not db_lead:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
        if current_user.role == RoleEnum.USER and db_lead.assigned_to != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this lead")
        
        for key, value in lead_update.model_dump(exclude_unset=True).items():
            setattr(db_lead, key, value)
        
        db.commit()
        db.refresh(db_lead)
        return db_lead
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating lead {lead_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update lead")

@router.delete("/leads/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead(lead_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role([RoleEnum.ADMIN, RoleEnum.MANAGER]))):
    try:
        db_lead = db.query(Lead).filter(Lead.id == lead_id).first()
        if not db_lead:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
        db.delete(db_lead)
        db.commit()
        return None
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting lead {lead_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete lead")
