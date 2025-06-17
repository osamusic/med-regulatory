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

database_url_env = os.getenv("DATABASE_URL")

if database_url_env:
    # パスワードに特殊文字が含まれている場合の対処
    if "mssql+pyodbc://" in database_url_env and any(c in database_url_env for c in ['#', '"', '^', '`', '@']):
        logger.info("DATABASE_URLに特殊文字が含まれています。SQLAlchemy URLを再構築します。")
        
        # URLから必要な情報を抽出
        from sqlalchemy.engine import URL
        import re
        
        # パターンマッチでユーザー名、パスワード、ホスト等を抽出
        match = re.match(r'mssql\+pyodbc://([^:]+):([^@]+)@([^/]+)/([^?]+)', database_url_env)
        if match:
            username = match.group(1)
            password = match.group(2)
            host_port = match.group(3)
            database = match.group(4)
            
            host = host_port.split(':')[0]
            port = int(host_port.split(':')[1]) if ':' in host_port else 1433
            
            # SQLAlchemy URLオブジェクトを作成
            DATABASE_URL = URL.create(
                "mssql+pyodbc",
                username=username,
                password=password,  # SQLAlchemyが自動的にエスケープ
                host=host,
                port=port,
                database=database,
                query={
                    "driver": "ODBC Driver 18 for SQL Server",
                    "TrustServerCertificate": "yes",
                    "Encrypt": "yes",
                    "timeout": "30",
                    "login_timeout": "30",
                }
            )
            logger.info(f"再構築されたURL: {str(DATABASE_URL).split('@')[0]}@***")
        else:
            DATABASE_URL = database_url_env
    else:
        DATABASE_URL = database_url_env
        logger.info(f"Using DATABASE_URL from environment: {DATABASE_URL.split('@')[0]}@***" if '@' in str(DATABASE_URL) else str(DATABASE_URL))
    
    sqlite_connect_args = {}
    
    # SQL Server specific configuration
    if str(DATABASE_URL).startswith("mssql+pyodbc://"):
        logger.info("Configuring SQL Server connection")
        # URL.create()を使った場合はqueryパラメータに設定が含まれているため、connect_argsは不要
        if hasattr(DATABASE_URL, 'query') and DATABASE_URL.query:
            logger.info("Using URL.create() with query parameters - no additional connect_args needed")
            non_sqlite_engine_kwargs = {
                "pool_pre_ping": True,  # Test connections before using
                "pool_recycle": 3600,  # Recycle connections after 1 hour for SQL Server
                "pool_size": 10,  # Number of connections to maintain in pool
                "max_overflow": 20,  # Maximum overflow connections allowed
                "pool_timeout": 30,  # Timeout for getting connection from pool
                "echo_pool": False,  # Set to True for pool debugging
            }
        else:
            logger.info("Using string URL - adding connect_args")
            non_sqlite_engine_kwargs = {
                "pool_pre_ping": True,  # Test connections before using
                "pool_recycle": 3600,  # Recycle connections after 1 hour for SQL Server
                "pool_size": 10,  # Number of connections to maintain in pool
                "max_overflow": 20,  # Maximum overflow connections allowed
                "pool_timeout": 30,  # Timeout for getting connection from pool
                "echo_pool": False,  # Set to True for pool debugging
                "connect_args": {
                    # 生のODBC接続で成功した設定を適用
                    "TrustServerCertificate": "yes",
                    "Encrypt": "yes",
                    "timeout": 30,
                    "login_timeout": 30,
                    "autocommit": False,
                    "connection_timeout": 30,
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
    logger.warning("DATABASE_URL not set, using SQLite as fallback")
    BASE_DIR = Path.cwd()
    db_path = BASE_DIR / "data" / "cyber_med_agent.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    DATABASE_URL = f"sqlite:///{db_path.as_posix()}"
    logger.info(f"Using SQLite database: {db_path}")
    sqlite_connect_args = {"check_same_thread": False}
    non_sqlite_engine_kwargs = {}


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
