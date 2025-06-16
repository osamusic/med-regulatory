"""Database health check utilities for detecting Azure SQL idle states."""

import logging
import time
from typing import Dict, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.orm import Session

from ..db.database import SessionLocal

logger = logging.getLogger(__name__)


class DatabaseHealthChecker:
    """Check database connectivity and detect idle states."""

    @staticmethod
    def check_connection(db: Optional[Session] = None) -> Tuple[bool, Dict[str, any]]:
        """Check database connection health.

        Args:
            db: Optional database session. If not provided, creates a new one.

        Returns:
            Tuple of (is_healthy, details_dict)
        """
        owns_session = db is None
        if owns_session:
            db = SessionLocal()

        start_time = time.time()
        details = {
            "status": "unknown",
            "response_time_ms": None,
            "error": None,
            "database_type": None,
            "is_idle": False,
        }

        try:
            # Execute a simple query to test connection
            result = db.execute(text("SELECT 1"))
            result.fetchone()

            # Get database type
            db_url = str(db.bind.url)
            if "sqlite" in db_url:
                details["database_type"] = "sqlite"
            elif "sqlserver" in db_url or "mssql" in db_url:
                details["database_type"] = "azure_sql"
            elif "postgresql" in db_url:
                details["database_type"] = "postgresql"
            else:
                details["database_type"] = "other"

            response_time = (time.time() - start_time) * 1000
            details["response_time_ms"] = round(response_time, 2)
            details["status"] = "healthy"

            # Check if response time indicates idle state (Azure SQL typically takes >1s when waking up)
            if details["database_type"] == "azure_sql" and response_time > 1000:
                details["is_idle"] = True
                details["status"] = "recovering_from_idle"

            return True, details

        except OperationalError as e:
            error_msg = str(e)
            logger.error(f"Database operational error: {error_msg}")
            details["status"] = "connection_failed"
            details["error"] = error_msg
            details["response_time_ms"] = round((time.time() - start_time) * 1000, 2)

            # Check for common Azure SQL idle/paused errors
            if any(
                term in error_msg.lower()
                for term in ["paused", "idle", "timeout", "login timeout"]
            ):
                details["is_idle"] = True
                details["status"] = "database_idle"
            else:
                # Don't expose detailed error messages
                details["error"] = "Connection error"

            return False, details

        except DBAPIError as e:
            error_msg = str(e)
            logger.error(f"Database API error: {error_msg}")
            details["status"] = "database_error"
            details["error"] = "Database error"  # Generic message
            details["response_time_ms"] = round((time.time() - start_time) * 1000, 2)
            return False, details

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Unexpected error checking database: {error_msg}")
            details["status"] = "unknown_error"
            details["error"] = "Health check failed"  # Generic message
            details["response_time_ms"] = round((time.time() - start_time) * 1000, 2)
            return False, details

        finally:
            if owns_session:
                db.close()
