#!/usr/bin/env python3
"""Initialize database with tables and sample data."""

import logging
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect

from src.db.database import DATABASE_URL, engine
from src.db.models import Base

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()


def init_database():
    """Initialize database tables and check connection."""
    try:
        logger.info(f"Connecting to database...")
        logger.info(f"Database URL: {DATABASE_URL.split('@')[0]}@***")
        
        # Test connection
        with engine.connect() as conn:
            logger.info("Database connection successful")
        
        # Get existing tables
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        logger.info(f"Existing tables: {existing_tables}")
        
        # Create all tables
        logger.info("Creating database tables...")
        Base.metadata.create_all(bind=engine)
        
        # Verify tables were created
        inspector = inspect(engine)
        tables_after = inspector.get_table_names()
        logger.info(f"Tables after creation: {tables_after}")
        
        # List all table schemas
        for table_name in tables_after:
            columns = inspector.get_columns(table_name)
            logger.info(f"\nTable '{table_name}' columns:")
            for col in columns:
                logger.info(f"  - {col['name']}: {col['type']}")
        
        logger.info("\nDatabase initialization completed successfully!")
        
    except Exception as e:
        logger.error(f"Database initialization failed: {str(e)}")
        raise


if __name__ == "__main__":
    init_database()