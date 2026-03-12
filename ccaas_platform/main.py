from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Request
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from typing import List, Dict
import json

import models, schemas, auth
from database import engine, get_db

# Create DB tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="CCaaS Platform API")

# Mount static files and templates
import os
os.makedirs("static/css", exist_ok=True)
os.makedirs("static/js", exist_ok=True)
os.makedirs("templates", exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# WebSocket Connection Manager for Real-Time Agent State & Routing
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}

    async def connect(self, websocket: WebSocket, agent_id: int):
        await websocket.accept()
        self.active_connections[agent_id] = websocket

    def disconnect(self, agent_id: int):
        if agent_id in self.active_connections:
            del self.active_connections[agent_id]

    async def send_personal_message(self, message: dict, agent_id: int):
        if agent_id in self.active_connections:
            await self.active_connections[agent_id].send_json(message)

    async def broadcast(self, message: dict):
        for connection in self.active_connections.values():
            await connection.send_json(message)

manager = ConnectionManager()

# --- Frontend Routes ---
@app.get("/")
async def serve_login(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/dashboard")
async def serve_dashboard(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request})

# --- API Routes ---
@app.post("/api/auth/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(username=user.username, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/api/auth/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = auth.timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/users/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.put("/api/users/me/status")
async def update_status(status: str, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if status not in ["offline", "available", "busy"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    current_user.status = status
    db.commit()
    await manager.broadcast({"type": "agent_status_update", "agent_id": current_user.id, "status": status})
    return {"message": "Status updated", "status": status}

@app.get("/api/interactions", response_model=List[schemas.InteractionResponse])
def get_interactions(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Agents see their own, admins see all
    if current_user.role == "admin":
        return db.query(models.Interaction).all()
    return db.query(models.Interaction).filter(models.Interaction.agent_id == current_user.id).all()

# --- WebSocket Route ---
@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str, db: Session = Depends(get_db)):
    try:
        # Authenticate WS connection
        payload = auth.jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        username: str = payload.get("sub")
        user = db.query(models.User).filter(models.User.username == username).first()
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        
        await manager.connect(websocket, user.id)
        
        # Send initial state
        await manager.send_personal_message({"type": "system", "message": "Connected to CCaaS Routing Engine"}, user.id)
        
        try:
            while True:
                data = await websocket.receive_text()
                message = json.loads(data)
                # Handle incoming WS messages from agent (e.g., accept interaction, complete interaction)
                if message.get("action") == "accept_interaction":
                    interaction_id = message.get("interaction_id")
                    interaction = db.query(models.Interaction).filter(models.Interaction.id == interaction_id).first()
                    if interaction and interaction.status == "waiting":
                        interaction.status = "active"
                        interaction.agent_id = user.id
                        user.status = "busy"
                        db.commit()
                        await manager.send_personal_message({"type": "interaction_accepted", "interaction": interaction.id}, user.id)
                        await manager.broadcast({"type": "queue_update"})
                        
        except WebSocketDisconnect:
            manager.disconnect(user.id)
            user.status = "offline"
            db.commit()
            await manager.broadcast({"type": "agent_status_update", "agent_id": user.id, "status": "offline"})
            
    except auth.JWTError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
