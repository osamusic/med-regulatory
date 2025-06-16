from datetime import datetime

import pytest

from src.db.models import Guideline, User


class TestUserModel:
    """Test User model functionality."""

    def test_user_creation(self, db_session):
        """Test user creation with required fields."""
        user = User(
            username="testuser",
            hashed_password="hashed_password",
            is_active=True,
            is_admin=False,
        )

        db_session.add(user)
        db_session.commit()

        assert user.id is not None
        assert user.username == "testuser"
        assert user.is_active is True
        assert user.is_admin is False
        assert isinstance(user.created_at, datetime)

    def test_user_unique_constraints(self, db_session):
        """Test unique constraints on username."""
        user1 = User(username="testuser", hashed_password="hashed_password")
        user2 = User(
            username="testuser", hashed_password="hashed_password"  # Same username
        )

        db_session.add(user1)
        db_session.commit()

        db_session.add(user2)
        with pytest.raises(Exception):  # Should raise integrity error
            db_session.commit()


class TestGuidelineModel:
    """Test Guideline model functionality."""

    def test_guideline_creation(self, db_session):
        """Test guideline creation with required fields."""
        guideline = Guideline(
            guideline_id="test-guideline-1",
            control_text="This is test control text",
            standard="Test Standard",
            source_url="https://example.com/test",
            category="security",
            subject="test subject",
        )

        db_session.add(guideline)
        db_session.commit()

        assert guideline.id is not None
        assert guideline.guideline_id == "test-guideline-1"
        assert guideline.standard == "Test Standard"
        assert guideline.category == "security"
        assert guideline.control_text == "This is test control text"

    def test_guideline_search_content(self, db_session):
        """Test guideline search functionality."""
        guideline1 = Guideline(
            guideline_id="security-guideline-1",
            control_text="This guideline covers cybersecurity best practices",
            standard="NIST",
            category="security",
        )
        guideline2 = Guideline(
            guideline_id="medical-guideline-1",
            control_text="This covers medical device requirements",
            standard="FDA",
            category="medical",
        )

        db_session.add_all([guideline1, guideline2])
        db_session.commit()

        # Test search by content
        security_guidelines = (
            db_session.query(Guideline)
            .filter(Guideline.control_text.contains("cybersecurity"))
            .all()
        )

        assert len(security_guidelines) == 1
        assert security_guidelines[0].guideline_id == "security-guideline-1"
