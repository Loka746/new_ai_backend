from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import models
from database import engine
from auth import router as auth_router
from routers.customers import router as customers_router
import os

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Modern CRM API", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(customers_router)

# Ensure static directory exists
os.makedirs("static/js", exist_ok=True)
os.makedirs("static/css", exist_ok=True)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def serve_index():
    return FileResponse("static/index.html")

@app.get("/dashboard")
async def serve_dashboard():
    return FileResponse("static/dashboard.html")
