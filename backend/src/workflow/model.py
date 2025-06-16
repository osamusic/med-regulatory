"""Pydantic models for workflow management."""

import json
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, computed_field


class WorkInstructionSchema(BaseModel):
    """Schema for work instruction with role and steps."""

    role: str
    steps: List[str]


class ProjectWorkflowSchema(BaseModel):
    """Schema for project workflow data."""

    id: str
    project_id: str
    phase: str
    workflow_text: str
    instructions_json: str = Field(exclude=True)
    input_json: Optional[str] = Field(default=None, exclude=True)
    output_json: Optional[str] = Field(default=None, exclude=True)

    @computed_field
    @property
    def instructions(self) -> Dict[str, List[str]]:
        """Parse instructions_json field into a dictionary."""
        try:
            if self.instructions_json:
                return json.loads(self.instructions_json)
        except (json.JSONDecodeError, TypeError):
            pass
        return {}

    @computed_field
    @property
    def input(self) -> Optional[Dict[str, Any]]:
        """Parse input_json field into a dictionary."""
        try:
            if self.input_json:
                return json.loads(self.input_json)
        except (json.JSONDecodeError, TypeError):
            pass
        return None

    @computed_field
    @property
    def output(self) -> Optional[Dict[str, Any]]:
        """Parse output_json field into a dictionary."""
        try:
            if self.output_json:
                return json.loads(self.output_json)
        except (json.JSONDecodeError, TypeError):
            pass
        return None

    class Config:
        """Pydantic configuration."""

        from_attributes = True
