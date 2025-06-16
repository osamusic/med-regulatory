from typing import List
from uuid import UUID

from pydantic import BaseModel

from ..db.models import PhaseEnum, PriorityEnum, RoleEnum, StatusEnum, SubjectEnum


class ProcessSchema(BaseModel):
    id: UUID
    original_text: str
    category: str
    standard: str

    processed_text: str
    subject: SubjectEnum
    phase: PhaseEnum
    priority: PriorityEnum
    role: RoleEnum
    status: StatusEnum

    cluster_id: str

    class Config:
        from_attributes = True


class ClusterSchema(BaseModel):
    cluster_id: UUID
    rep_text: str
    documents: List[ProcessSchema]

    class Config:
        from_attributes = True
