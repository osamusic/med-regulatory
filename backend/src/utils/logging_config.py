"""Logging configuration utilities for MedShield AI.

This module provides centralized logging configuration with environment-based
log levels and audit logging capabilities.
"""

import logging
import os


def configure_logging():
    """Configure logging based on environment.

    Returns:
        Tuple of (environment, audit_log_function).
    """
    environment = os.getenv("ENVIRONMENT", "development")

    if environment == "production":
        default_level = logging.ERROR
    else:
        default_level = logging.INFO

    logging.basicConfig(
        level=default_level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        force=True,  # Force reconfiguration to override any existing settings
    )

    logging.getLogger().setLevel(default_level)

    def audit_log(logger, message):
        """Log audit messages with special handling.

        Args:
            logger: Logger instance to use.
            message: Message to log.
        """
        if message.startswith("AUDIT LOG:"):
            logger.error(message)
        elif environment != "production":
            logger.info(message)

    return environment, audit_log
