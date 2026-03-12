from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    role: str
    status: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class InteractionBase(BaseModel):
    customer_name: str
    channel: str
    queue_id: int

class InteractionResponse(InteractionBase):
    id: int
    status: str
    agent_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True
