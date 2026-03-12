import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

# Database Configuration for CCaaS Platform
# Defaulting to SQLite for easy setup, but fully compatible with PostgreSQL/MySQL
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./ccaas_platform.db")

# Create SQLAlchemy engine
# The connect_args dictionary is specifically required for SQLite to allow multiple threads
# to interact with the database, which is common in web applications like FastAPI.
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)

# SessionLocal class serves as a factory for new database sessions
# autocommit=False ensures we manually commit transactions (safer)
# autoflush=False prevents automatic flushing of pending changes before queries
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for all declarative SQLAlchemy models
# All models in models.py will inherit from this Base
Base = declarative_base()

def get_db():
    """
    Dependency generator for database sessions.
    This function is used in FastAPI route endpoints to inject a database session.
    It yields a session and ensures it is properly closed after the request completes,
    preventing connection leaks.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """
    Initializes the database by creating all tables defined in the models.
    This should be called during application startup.
    """
    import ccaas_project.models  # Import models to ensure they are registered with Base
    Base.metadata.create_all(bind=engine)
