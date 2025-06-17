"""Database configuration and session management for MedShield AI.

This module configures SQLAlchemy database connections, handles both SQLite
and PostgreSQL databases, and provides database session management.
"""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

load_dotenv()
logger = logging.getLogger(__name__)

if os.getenv("DATABASE_URL"):
    DATABASE_URL = os.getenv("DATABASE_URL")
    logger.info(f"Using DATABASE_URL from environment: {DATABASE_URL.split('@')[0]}@***")
    sqlite_connect_args = {}
    
    # SQL Server specific configuration
    if DATABASE_URL.startswith("mssql+pyodbc://"):
        logger.info("Configuring SQL Server connection")
        non_sqlite_engine_kwargs = {
            "pool_pre_ping": True,  # Test connections before using
            "pool_recycle": 3600,  # Recycle connections after 1 hour for SQL Server
            "pool_size": 10,  # Number of connections to maintain in pool
            "max_overflow": 20,  # Maximum overflow connections allowed
            "pool_timeout": 30,  # Timeout for getting connection from pool
            "echo_pool": False,  # Set to True for pool debugging
            "connect_args": {
                "driver": "ODBC Driver 18 for SQL Server",
                "TrustServerCertificate": "yes",
                "timeout": 30,
                "autocommit": False,
            }
        }
    else:
        # Default configuration for other databases
        logger.info("Configuring default database connection")
        non_sqlite_engine_kwargs = {
            "pool_pre_ping": True,  # Test connections before using
            "pool_recycle": 1700,  # Recycle connections after ~28 minutes
            "pool_size": 5,  # Number of connections to maintain in pool
            "max_overflow": 10,  # Maximum overflow connections allowed
            "pool_timeout": 30,  # Timeout for getting connection from pool
            "echo_pool": False,  # Set to True for pool debugging
        }
else:
    BASE_DIR = Path.cwd()
    db_path = BASE_DIR / "data" / "cyber_med_agent.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    DATABASE_URL = f"sqlite:///{db_path.as_posix()}"
    logger.info(f"Using SQLite database: {db_path}")
    sqlite_connect_args = {"check_same_thread": False}
    non_sqlite_engine_kwargs = {}


try:
    engine = create_engine(
        DATABASE_URL, connect_args=sqlite_connect_args, **non_sqlite_engine_kwargs
    )
    logger.info("Database engine created successfully")
except Exception as e:
    logger.error(f"Failed to create database engine: {str(e)}")
    # Fallback to SQLite if Cloud SQL fails
    if "mssql" in DATABASE_URL or "sqlserver" in DATABASE_URL:
        logger.warning("Falling back to SQLite database")
        BASE_DIR = Path.cwd()
        db_path = BASE_DIR / "data" / "cyber_med_agent.db"
        db_path.parent.mkdir(parents=True, exist_ok=True)
        DATABASE_URL = f"sqlite:///{db_path.as_posix()}"
        engine = create_engine(
            DATABASE_URL, connect_args={"check_same_thread": False}
        )
    else:
        raise

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Create and yield a database session.

    Yields:
        SQLAlchemy database session.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
