"""Password validation utilities for strong password enforcement."""

import re
from typing import Any, Dict


def validate_password_strength(password: str) -> Dict[str, Any]:
    """
    Validate password strength according to security policy.

    Requirements:
    - At least 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one number
    - At least one special character

    Args:
        password: Password to validate

    Returns:
        Dictionary with validation results
    """
    errors = []
    checks = {
        "length": False,
        "uppercase": False,
        "lowercase": False,
        "numbers": False,
        "special_chars": False,
    }

    # Length check (minimum 8 characters)
    if len(password) >= 8:
        checks["length"] = True
    else:
        errors.append("Password must be at least 8 characters long")

    # Uppercase letter check
    if re.search(r"[A-Z]", password):
        checks["uppercase"] = True
    else:
        errors.append("Password must contain at least one uppercase letter")

    # Lowercase letter check
    if re.search(r"[a-z]", password):
        checks["lowercase"] = True
    else:
        errors.append("Password must contain at least one lowercase letter")

    # Number check
    if re.search(r"[0-9]", password):
        checks["numbers"] = True
    else:
        errors.append("Password must contain at least one number")

    # Special character check
    if re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]", password):
        checks["special_chars"] = True
    else:
        errors.append(
            "Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)"
        )

    is_valid = len(errors) == 0

    return {
        "is_valid": is_valid,
        "errors": errors,
        "checks": checks,
    }
