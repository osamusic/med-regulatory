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
logger.info("Loading database configuration")

# SQL Server接続用の環境変数を直接取得
db_user = os.getenv("DB_USER")
db_password = os.getenv("DB_PASSWORD")
db_name = os.getenv("DB_NAME")
database_url_env = os.getenv("DATABASE_URL")

# SQL Server用の個別環境変数が設定されている場合は、常にURL.create()を使用
if db_user and db_password and db_name:
    logger.info("SQL Server環境変数が設定されています。URL.create()を使用します。")
    from sqlalchemy.engine import URL
    
    # SQLAlchemy URLオブジェクトを作成（テストプログラムと同じ方式）
    DATABASE_URL = URL.create(
        "mssql+pyodbc",
        username=db_user,
        password=db_password,  # SQLAlchemyが自動的にエスケープ
        host="cloud-sql-proxy",
        port=1433,
        database=db_name,
        query={
            "driver": "ODBC Driver 18 for SQL Server",
            "TrustServerCertificate": "yes",
            "Encrypt": "yes",
            "timeout": "30",
            "login_timeout": "30",
        }
    )
    logger.info(f"URL.create()で構築したURL: {str(DATABASE_URL).split('@')[0]}@***")
elif database_url_env:
    DATABASE_URL = database_url_env
    logger.info(f"Using DATABASE_URL from environment: {DATABASE_URL.split('@')[0]}@***" if '@' in str(DATABASE_URL) else str(DATABASE_URL))
else:
    logger.warning("DATABASE_URL not set, using SQLite as fallback")
    BASE_DIR = Path.cwd()
    db_path = BASE_DIR / "data" / "cyber_med_agent.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    DATABASE_URL = f"sqlite:///{db_path.as_posix()}"
    logger.info(f"Using SQLite database: {db_path}")

# 共通変数の初期化
sqlite_connect_args = {}
non_sqlite_engine_kwargs = {}

# SQL Server specific configuration
if str(DATABASE_URL).startswith("mssql+pyodbc://"):
    logger.info("Configuring SQL Server connection")
    # URL.create()を使った場合はqueryパラメータに設定が含まれているため、connect_argsは不要
    non_sqlite_engine_kwargs = {
        "pool_pre_ping": True,  # Test connections before using
        "pool_recycle": 3600,  # Recycle connections after 1 hour for SQL Server
        "pool_size": 10,  # Number of connections to maintain in pool
        "max_overflow": 20,  # Maximum overflow connections allowed
        "pool_timeout": 30,  # Timeout for getting connection from pool
        "echo_pool": False,  # Set to True for pool debugging
    }
elif DATABASE_URL.startswith("sqlite://"):
    logger.info("Configuring SQLite connection")
    sqlite_connect_args = {"check_same_thread": False}
    non_sqlite_engine_kwargs = {}
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


try:
    if str(DATABASE_URL).startswith("mssql+pyodbc://"):
        # For SQL Server, use only the kwargs (which include connect_args)
        engine = create_engine(DATABASE_URL, **non_sqlite_engine_kwargs)
    else:
        # For other databases, use the separate connect_args
        engine = create_engine(
            DATABASE_URL, connect_args=sqlite_connect_args, **non_sqlite_engine_kwargs
        )
    logger.info("Database engine created successfully")
except Exception as e:
    logger.error(f"Failed to create database engine: {str(e)}")
    # Fallback to SQLite if Cloud SQL fails
    if "mssql" in str(DATABASE_URL) or "sqlserver" in str(DATABASE_URL):
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
