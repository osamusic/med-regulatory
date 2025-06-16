from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class LogEntry(BaseModel):
    id: int
    action: str
    timestamp: datetime
    user_id: int
    details: Optional[str] = None
    ip_address: Optional[str] = None

    class Config:
        from_attributes = True


class DocumentInfo(BaseModel):
    id: int
    doc_id: str
    title: str
    source_type: str
    downloaded_at: datetime
    url: str
    original_title: Optional[str] = None
    is_classified: bool = False

    class Config:
        from_attributes = True


class DeleteConfirmation(BaseModel):
    confirmed: bool


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    original_title: Optional[str] = None


class SystemSettingRequest(BaseModel):
    value: str


class SystemSettingResponse(BaseModel):
    key: str
    value: str
    description: Optional[str] = None
    updated_at: datetime
    updated_by: Optional[int] = None

    class Config:
        from_attributes = True
