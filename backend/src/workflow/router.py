"""Workflow router for project workflow management."""

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth.hybrid_auth import get_admin_user
from ..db.database import get_db
from ..db.models import AssessmentProject, ProcessDocument, ProjectWorkflow
from .model import ProjectWorkflowSchema
from .workflow import (
    call_llm,
    extract_inputs_outputs,
    extract_instructions,
    extract_summary,
    workflow_prompt,
)

router = APIRouter(prefix="/workflow", tags=["workflow"])


@router.post("/create/{project_id}/{phase}", response_model=ProjectWorkflowSchema)
def generate_phase_workflow(
    project_id: str,
    phase: str,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    """Generate a workflow for a specific project phase."""
    # Verify project exists
    project = (
        db.query(AssessmentProject).filter(AssessmentProject.id == project_id).first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check if workflow already exists for this project and phase
    existing_workflow = (
        db.query(ProjectWorkflow)
        .filter(
            ProjectWorkflow.project_id == project_id, ProjectWorkflow.phase == phase
        )
        .first()
    )

    if existing_workflow:
        raise HTTPException(
            status_code=400,
            detail=f"Workflow already exists for phase {phase} in project {project_id}",
        )

    # Get documents for this project and phase
    # Note: ProcessDocument doesn't have project_id, so we need to filter differently
    # Based on the model, we should filter using the project's filters
    query = db.query(ProcessDocument)

    # Apply project filters if they exist
    if project.filter_subject:
        query = query.filter(ProcessDocument.subject == project.filter_subject)
    if project.filter_phase:
        query = query.filter(ProcessDocument.phase == project.filter_phase)
    if project.filter_role:
        query = query.filter(ProcessDocument.role == project.filter_role)
    if project.filter_priority:
        query = query.filter(ProcessDocument.priority == project.filter_priority)
    if project.filter_category:
        query = query.filter(ProcessDocument.category == project.filter_category)
    if project.filter_standard:
        query = query.filter(ProcessDocument.standard == project.filter_standard)

    # Also filter by the specific phase requested
    docs = query.filter(ProcessDocument.phase == phase).all()

    if not docs:
        raise HTTPException(
            status_code=404,
            detail=f"No documents found for phase {phase} in project {project_id}",
        )

    # requirements_per_role
    requirements_per_role = "\n".join(
        [f"{doc.role}: {doc.processed_text}" for doc in docs if doc.processed_text]
    )

    if not requirements_per_role:
        raise HTTPException(
            status_code=400, detail="No processed text found in documents"
        )

    # LLM call
    prompt = workflow_prompt.format(
        phase=phase, requirements_per_role=requirements_per_role
    )
    workflow_result = call_llm(prompt)

    workflow_text = extract_summary(workflow_result)
    instructions = extract_instructions(workflow_result)
    inputs, outputs = extract_inputs_outputs(workflow_result)

    pfw = ProjectWorkflow(
        project_id=project_id,
        phase=phase,
        workflow_text=workflow_text,
        instructions_json=json.dumps(instructions),
        input_json=json.dumps(inputs) if inputs else None,
        output_json=json.dumps(outputs) if outputs else None,
    )
    db.add(pfw)
    db.commit()
    db.refresh(pfw)
    return pfw


@router.get("/get/{project_id}/{phase}", response_model=ProjectWorkflowSchema)
def get_phase_workflow(project_id: str, phase: str, db: Session = Depends(get_db)):
    """Get a workflow for a specific project phase."""
    workflow = (
        db.query(ProjectWorkflow)
        .filter(
            ProjectWorkflow.project_id == project_id, ProjectWorkflow.phase == phase
        )
        .first()
    )

    if not workflow:
        raise HTTPException(
            status_code=404,
            detail=f"Workflow not found for phase {phase} in project {project_id}",
        )

    return workflow


@router.get("/list/{project_id}")
def list_project_workflows(project_id: str, db: Session = Depends(get_db)):
    """List all workflows for a project."""
    # Verify project exists
    project = (
        db.query(AssessmentProject).filter(AssessmentProject.id == project_id).first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    workflows = (
        db.query(ProjectWorkflow).filter(ProjectWorkflow.project_id == project_id).all()
    )

    return {"project_id": project_id, "workflows": workflows}


@router.delete("/delete/{project_id}/{phase}")
def delete_phase_workflow(
    project_id: str,
    phase: str,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    """Delete a workflow for a specific project phase."""
    workflow = (
        db.query(ProjectWorkflow)
        .filter(
            ProjectWorkflow.project_id == project_id, ProjectWorkflow.phase == phase
        )
        .first()
    )

    if not workflow:
        raise HTTPException(
            status_code=404,
            detail=f"Workflow not found for phase {phase} in project {project_id}",
        )

    db.delete(workflow)
    db.commit()

    return {
        "message": f"Workflow for phase {phase} in project {project_id} deleted successfully"
    }
