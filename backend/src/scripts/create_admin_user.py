"""Script to create an admin user for MedShield AI.

This script creates an admin user with default credentials for initial
system setup and administrative access.
"""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from src.auth.auth import get_password_hash
from src.db.database import get_db
from src.db.models import User


def create_admin_user():
    """Create an admin user with default credentials."""
    print("===== 管理者ユーザー作成 =====")

    db = next(get_db())

    existing_user = db.query(User).filter(User.username == "admin").first()

    if existing_user:
        print(f"管理者ユーザー 'admin' は既に存在します")
        return

    admin_user = User(
        username="admin", hashed_password=get_password_hash("password"), is_admin=True
    )

    try:
        db.add(admin_user)
        db.commit()
        print(f"管理者ユーザー 'admin' を作成しました")
    except Exception as e:
        db.rollback()
        print(f"ユーザー作成エラー: {str(e)}")


if __name__ == "__main__":
    create_admin_user()
