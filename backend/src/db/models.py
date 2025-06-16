"""Database models for MedShield AI.

This module defines all SQLAlchemy ORM models for the medical device
cybersecurity expert system, including users, documents, guidelines,
and assessment workflows.
"""

import enum
from datetime import datetime
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    """User model for authentication and authorization."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(256), unique=True, index=True)
    hashed_password = Column(String(512))
    firebase_uid = Column(String(256), unique=True, index=True, nullable=True)
    is_admin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=False)  # Users are inactive by default
    created_at = Column(DateTime, default=datetime.utcnow)

    documents = relationship("DocumentModel", back_populates="owner")
    classifications = relationship("ClassificationResult", back_populates="user")


class DocumentModel(Base):
    """Document model for storing crawled cybersecurity documents."""

    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    doc_id = Column(String(512), unique=True, index=True)
    url = Column(String(512))
    title = Column(String(512))
    original_title = Column(String(512))
    content = Column(Text)
    source_type = Column(String(50))  # PDF, HTML, DOCX
    downloaded_at = Column(DateTime)
    lang = Column(String(10))
    owner_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="documents")
    sections = relationship("DocumentSection", back_populates="document")
    classifications = relationship("ClassificationResult", back_populates="document")


class DocumentSection(Base):
    """Document section model for storing document chunks and embeddings."""

    __tablename__ = "document_sections"

    id = Column(Integer, primary_key=True, index=True)
    node_id = Column(String(512), unique=True, index=True)
    text_chunk = Column(Text)
    document_id = Column(Integer, ForeignKey("documents.id"))
    section_number = Column(Integer)

    document = relationship("DocumentModel", back_populates="sections")
    guidelines = relationship("Guideline", back_populates="section")


class Guideline(Base):
    """Guideline model for cybersecurity recommendations and controls."""

    __tablename__ = "guidelines"

    id = Column(Integer, primary_key=True, index=True)
    guideline_id = Column(String(512), unique=True, index=True)
    category = Column(String(512), index=True)
    standard = Column(String(512), index=True)
    control_text = Column(Text)
    source_url = Column(String(512))
    subject = Column(String(512))
    section_id = Column(Integer, ForeignKey("document_sections.id"))

    section = relationship("DocumentSection", back_populates="guidelines")
    keywords = relationship("GuidelineKeyword", back_populates="guideline")


class GuidelineKeyword(Base):
    """Keyword model for guideline searchability."""

    __tablename__ = "guideline_keywords"

    id = Column(Integer, primary_key=True, index=True)
    keyword = Column(String(512), index=True)
    guideline_id = Column(Integer, ForeignKey("guidelines.id"))

    guideline = relationship("Guideline", back_populates="keywords")


class ClassificationResult(Base):
    """Model for storing AI classification results of documents."""

    __tablename__ = "classification_results"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    result_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("DocumentModel", back_populates="classifications")
    user = relationship("User", back_populates="classifications")


class Article(Base):
    """News article model for cybersecurity news collection."""

    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(512))
    url = Column(String(512), unique=True, index=True)
    summary = Column(Text)
    keywords = Column(String(512))
    saved_at = Column(String(50))
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    owner = relationship("User", back_populates="articles")


User.articles = relationship("Article", back_populates="owner")


class NewsSettings(Base):
    """Configuration settings for news collection."""

    __tablename__ = "news_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(50), unique=True, index=True)  # 'sites' or 'keywords'
    value = Column(Text)  # JSON string of values
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @classmethod
    def get_settings(cls, db, key, default=None):
        """Get settings value by key.

        Args:
            db: Database session.
            key: Settings key.
            default: Default value if key not found.

        Returns:
            Settings value or default.
        """
        setting = db.query(cls).filter(cls.key == key).first()
        return setting.value if setting else default

    @classmethod
    def update_settings(cls, db, key, value):
        """Update or create settings value.

        Args:
            db: Database session.
            key: Settings key.
            value: Settings value.

        Returns:
            Updated settings object.
        """
        setting = db.query(cls).filter(cls.key == key).first()
        if not setting:
            setting = cls(key=key, value=value)
            db.add(setting)
        else:
            setting.value = value
        db.commit()
        return setting


class SubjectEnum(str, enum.Enum):
    """Enumeration for cybersecurity subject types."""

    manufacturer = "Manufacturer"
    healthcare_provider = "Healthcare Provider"
    regulatory_authority = "Regulatory Authority"
    unknown = "unknown"


class PhaseEnum(str, enum.Enum):
    """Enumeration for device lifecycle phases."""

    design = "Design"
    development = "Development"
    premarket = "Pre-market"
    operation = "Operation"
    incident_response = "Incident Response"
    disposal = "Disposal"
    unknown = "unknown"


class PriorityEnum(str, enum.Enum):
    """Enumeration for guideline priority levels."""

    shall = "Shall"
    should = "Should"
    unknown = "unknown"


class StatusEnum(str, enum.Enum):
    """Enumeration for assessment status values."""

    not_started = "Not Started"
    in_progress = "In Progress"
    compliant = "Compliant"
    non_compliant = "Non-Compliant"
    not_applicable = "Not Applicable"
    unknown = "unknown"


class RoleEnum(str, enum.Enum):
    """Enumeration for organizational roles in cybersecurity."""

    # Manufacturer roles only
    dev_engineer = "Development Engineer"
    security_architect = "Security Architect"
    qa_engineer = "Quality Assurance"
    regulatory_affairs = "Regulatory Affairs"
    product_manager = "Product Manager"
    ops_engineer = "Operations Engineer"
    incident_responder = "Incident Response Specialist"
    # Non-manufacturer entries (generalized)
    other = "Other"
    unknown = "unknown"


class ProcessDocument(Base):
    """Model for processed cybersecurity documents with categorization."""

    __tablename__ = "process_documents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    original_text = Column(Text, nullable=False)
    category = Column(String(512), nullable=False, index=True)
    standard = Column(String(512), nullable=False, index=True)

    processed_text = Column(Text)
    subject = Column(
        String(64), nullable=False, index=True, default=str(SubjectEnum.unknown)
    )
    phase = Column(
        String(64), nullable=False, index=True, default=str(PhaseEnum.unknown)
    )
    priority = Column(
        String(64), nullable=False, index=True, default=str(PriorityEnum.unknown)
    )
    role = Column(String(64), nullable=False, index=True, default=str(RoleEnum.unknown))
    status = Column(Enum(StatusEnum), default=StatusEnum.not_started, index=True)

    cluster_id = Column(
        String(36), ForeignKey("process_clusters.id"), nullable=True, index=True
    )
    cluster = relationship("ProcessCluster", back_populates="documents")


class ProcessCluster(Base):
    """Model for clustering related process documents."""

    __tablename__ = "process_clusters"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    rep_text = Column(Text, nullable=False)

    # 逆リレーション：このクラスタに属するプロセス文書たち
    documents = relationship("ProcessDocument", back_populates="cluster")


class AssessmentProject(Base):
    """Model for cybersecurity assessment projects."""

    __tablename__ = "assessment_projects"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name = Column(String(512), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    filter_subject = Column(String(64))
    filter_phase = Column(String(64))
    filter_role = Column(String(64))
    filter_priority = Column(String(64))
    filter_category = Column(String(512))
    filter_standard = Column(String(512))

    assessments = relationship("Assessment", back_populates="project")


class Assessment(Base):
    """Model for individual assessment items within projects."""

    __tablename__ = "assessments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    project_id = Column(
        String(36), ForeignKey("assessment_projects.id"), nullable=False
    )
    document_id = Column(String(36), ForeignKey("process_documents.id"), nullable=False)
    status = Column(Enum(StatusEnum), default=StatusEnum.not_started, nullable=False)
    notes = Column(Text)
    assessed_at = Column(DateTime)
    assessed_by = Column(Integer, ForeignKey("users.id"))

    project = relationship("AssessmentProject", back_populates="assessments")
    document = relationship("ProcessDocument")
    assessor = relationship("User")


class ProjectWorkflow(Base):
    """Model for project workflow definitions and instructions."""

    __tablename__ = "project_workflows"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    project_id = Column(
        String(36), ForeignKey("assessment_projects.id"), nullable=False, index=True
    )
    phase = Column(String(64), nullable=False, index=True)
    workflow_text = Column(Text, nullable=False)
    instructions_json = Column(Text, nullable=False)
    input_json = Column(Text, nullable=True)
    output_json = Column(Text, nullable=True)

    project = relationship("AssessmentProject")


class SystemSetting(Base):
    """Model for system-wide configuration settings."""

    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(255), unique=True, nullable=False, index=True)
    value = Column(String(1000), nullable=False)
    description = Column(String(500), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    updater = relationship("User")

    @classmethod
    def get_setting(cls, db, key: str, default: str = None):
        """Get a system setting value.

        Args:
            db: Database session.
            key: Setting key.
            default: Default value if key not found.

        Returns:
            Setting value or default.
        """
        setting = db.query(cls).filter(cls.key == key).first()
        return setting.value if setting else default

    @classmethod
    def set_setting(
        cls, db, key: str, value: str, user_id: int = None, description: str = None
    ):
        """Set a system setting value.

        Args:
            db: Database session.
            key: Setting key.
            value: Setting value.
            user_id: ID of user making the change.
            description: Optional description of the setting.

        Returns:
            Updated setting object.
        """
        setting = db.query(cls).filter(cls.key == key).first()
        if setting:
            setting.value = value
            setting.updated_by = user_id
            setting.updated_at = datetime.utcnow()
        else:
            setting = cls(
                key=key, value=value, description=description, updated_by=user_id
            )
            db.add(setting)
        db.commit()
        db.refresh(setting)
        return setting
