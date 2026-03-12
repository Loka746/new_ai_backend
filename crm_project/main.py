from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import List, Optional
from datetime import timedelta
import os

from database import engine, Base, get_db
import models
import schemas
import auth

# Create all database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="CRM API",
    description="Complete Production-Ready CRM API built with FastAPI",
    version="1.0.0"
)

# Mount static files for serving HTML/CSS/JS
app.mount("/static", StaticFiles(directory="static"), name="static")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Auth Routes ---
@app.post("/api/auth/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(
        email=user.email,
        full_name=user.full_name,
        hashed_password=hashed_password,
        role=user.role,
        is_active=user.is_active
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/api/auth/login", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email, "role": user.role, "id": user.id},
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

# --- Customer Routes ---
@app.post("/api/customers", response_model=schemas.CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(customer: schemas.CustomerCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_customer = models.Customer(**customer.dict())
    if db_customer.assigned_to is None:
        db_customer.assigned_to = current_user.id
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer

@app.get("/api/customers", response_model=schemas.PaginatedCustomerResponse)
def read_customers(
    skip: int = 0, 
    limit: int = 10, 
    search: Optional[str] = None,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    query = db.query(models.Customer)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                models.Customer.first_name.ilike(search_term),
                models.Customer.last_name.ilike(search_term),
                models.Customer.email.ilike(search_term),
                models.Customer.company.ilike(search_term)
            )
        )
    
    total = query.count()
    customers = query.order_by(models.Customer.id.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": customers}

@app.get("/api/customers/{customer_id}", response_model=schemas.CustomerResponse)
def read_customer(customer_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer

@app.put("/api/customers/{customer_id}", response_model=schemas.CustomerResponse)
def update_customer(customer_id: int, customer_update: schemas.CustomerUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if db_customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    update_data = customer_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_customer, key, value)
        
    db.commit()
    db.refresh(db_customer)
    return db_customer

@app.delete("/api/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(customer_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if db_customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    db.delete(db_customer)
    db.commit()
    return None

# --- Deal Routes ---
@app.post("/api/deals", response_model=schemas.DealResponse, status_code=status.HTTP_201_CREATED)
def create_deal(deal: schemas.DealCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_deal = models.Deal(**deal.dict())
    if db_deal.assigned_to is None:
        db_deal.assigned_to = current_user.id
    db.add(db_deal)
    db.commit()
    db.refresh(db_deal)
    return db_deal

@app.get("/api/deals", response_model=schemas.PaginatedDealResponse)
def read_deals(
    skip: int = 0, 
    limit: int = 10, 
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    query = db.query(models.Deal)
    if search:
        query = query.filter(models.Deal.title.ilike(f"%{search}%"))
    if status:
        query = query.filter(models.Deal.status == status)
        
    total = query.count()
    deals = query.order_by(models.Deal.id.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": deals}

@app.get("/api/deals/{deal_id}", response_model=schemas.DealResponse)
def read_deal(deal_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if deal is None:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal

@app.put("/api/deals/{deal_id}", response_model=schemas.DealResponse)
def update_deal(deal_id: int, deal_update: schemas.DealUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if db_deal is None:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    update_data = deal_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_deal, key, value)
        
    db.commit()
    db.refresh(db_deal)
    return db_deal

@app.delete("/api/deals/{deal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deal(deal_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if db_deal is None:
        raise HTTPException(status_code=404, detail="Deal not found")
    db.delete(db_deal)
    db.commit()
    return None

# --- Interaction Routes ---
@app.post("/api/interactions", response_model=schemas.InteractionResponse, status_code=status.HTTP_201_CREATED)
def create_interaction(interaction: schemas.InteractionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_interaction = models.Interaction(**interaction.dict(), user_id=current_user.id)
    db.add(db_interaction)
    db.commit()
    db.refresh(db_interaction)
    return db_interaction

@app.get("/api/interactions", response_model=schemas.PaginatedInteractionResponse)
def read_interactions(
    customer_id: Optional[int] = None,
    deal_id: Optional[int] = None,
    skip: int = 0, 
    limit: int = 20, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    query = db.query(models.Interaction)
    if customer_id:
        query = query.filter(models.Interaction.customer_id == customer_id)
    if deal_id:
        query = query.filter(models.Interaction.deal_id == deal_id)
        
    total = query.count()
    interactions = query.order_by(models.Interaction.date.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": interactions}

# --- Dashboard Stats Route ---
@app.get("/api/stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    total_customers = db.query(models.Customer).count()
    total_deals = db.query(models.Deal).count()
    deals_won = db.query(models.Deal).filter(models.Deal.status == "won").count()
    total_revenue = db.query(func.sum(models.Deal.value)).filter(models.Deal.status == "won").scalar() or 0.0
    
    recent_customers = db.query(models.Customer).order_by(models.Customer.id.desc()).limit(5).all()
    recent_deals = db.query(models.Deal).order_by(models.Deal.id.desc()).limit(5).all()
    
    return {
        "total_customers": total_customers,
        "total_deals": total_deals,
        "total_revenue": total_revenue,
        "deals_won": deals_won,
        "recent_customers": recent_customers,
        "recent_deals": recent_deals
    }

# --- Frontend serving ---
from fastapi.responses import FileResponse

@app.get("/")
def serve_index():
    return FileResponse("index.html")

@app.get("/dashboard")
def serve_dashboard():
    return FileResponse("dashboard.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
