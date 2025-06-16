from typing import Optional

from pydantic import BaseModel


class GuidelineBase(BaseModel):
    category: str
    standard: str
    control_text: str
    source_url: str
    subject: str


class GuidelineCreate(GuidelineBase):
    guideline_id: str


class Guideline(GuidelineBase):
    id: int
    guideline_id: str

    class Config:
        from_attributes = True


class GuidelineSearch(BaseModel):
    query: str
    category: Optional[str] = None
    standard: Optional[str] = None
    subject: Optional[str] = None
