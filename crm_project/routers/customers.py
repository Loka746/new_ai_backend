from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import models, schemas, database
from auth import get_current_user

router = APIRouter(prefix="/api/customers", tags=["Customers"])

@router.post("/", response_model=schemas.CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(customer: schemas.CustomerCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_customer = db.query(models.Customer).filter(models.Customer.email == customer.email).first()
    if db_customer:
        raise HTTPException(status_code=400, detail="Customer with this email already exists")
    
    new_customer = models.Customer(**customer.model_dump(), owner_id=current_user.id)
    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)
    return new_customer

@router.get("/", response_model=List[schemas.CustomerResponse])
def get_customers(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    customers = db.query(models.Customer).filter(models.Customer.owner_id == current_user.id).offset(skip).limit(limit).all()
    return customers

@router.get("/{customer_id}", response_model=schemas.CustomerResponse)
def get_customer(customer_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id, models.Customer.owner_id == current_user.id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer

@router.put("/{customer_id}", response_model=schemas.CustomerResponse)
def update_customer(customer_id: int, customer_update: schemas.CustomerUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id, models.Customer.owner_id == current_user.id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    for key, value in customer_update.model_dump().items():
        setattr(customer, key, value)
        
    db.commit()
    db.refresh(customer)
    return customer

@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(customer_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id, models.Customer.owner_id == current_user.id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    db.delete(customer)
    db.commit()
    return None
