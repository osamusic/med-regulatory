# FastAPI ルーター（擬似コード）
import asyncio
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from fastapi_cache.decorator import cache
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..auth.hybrid_auth import get_admin_user, get_current_active_user
from ..db.database import SessionLocal, get_db
from ..db.models import (
    Assessment,
    AssessmentProject,
    Guideline,
    PhaseEnum,
    PriorityEnum,
    ProcessCluster,
    ProcessDocument,
    RoleEnum,
    StatusEnum,
    SubjectEnum,
)
from ..utils.api_cache import invalidate_cache
from .model import ClusterSchema
from .proc import classify_and_save, cluster_documents

logger = logging.getLogger(__name__)
REDIS_TTL = int(os.getenv("REDIS_CACHE_TTL", "3600"))  # Default: 1 hour
executor = ThreadPoolExecutor(max_workers=1)

router = APIRouter(
    prefix="/proc", tags=["process"], dependencies=[Depends(get_current_active_user)]
)


def process_task(process_all: bool):
    db: Session = SessionLocal()
    try:
        logger.info("start of classify and cluster")
        if process_all:
            docs_to_classify = db.query(ProcessDocument).all()
        else:
            docs_to_classify = (
                db.query(ProcessDocument)
                .filter(ProcessDocument.subject == SubjectEnum.unknown)
                .all()
            )
        texts_with_ids = [(doc.original_text, doc.id) for doc in docs_to_classify]
        classify_and_save(db, texts_with_ids)

        clst_result = cluster_documents(db, similarity_threshold=0.88)
    except Exception as e:
        logger.error(f">>> blocking_task_in_thread で例外発生:{e}")

    finally:
        db.close()
        logger.info("end of classify and cluster")

    return {
        "classified_count": len(texts_with_ids),
        "clustered_count": str(clst_result["clustered"]),
    }


@router.post("/process", response_model=dict)
async def sync_and_classify_documents(
    db: Session = Depends(get_db),
    process_all: bool = Body(
        False, embed=True, description="If True , classify whole docs"
    ),
):
    """
    1) sync Guideline DB and ProcessDocument table
    2) classify document and save
    request JSON:
    {
      "process_all": false  # True にすると、すでに分類済みのドキュメントも再度分類対象に含める
    }
    response:
    {
      "sync_count": 10,
      "skip_count": 5,
      "attempted_to_classify": 12,
      "classified_count": 11,
      "failed_items": [
         { "id": "xxxx-xxxx-xxxx", "error": "..." }
      ]
    }
    """

    def _sync_db(session: Session) -> dict:
        """
        Guideline table to  ProcessDocument
        """
        guidelines = session.query(Guideline).all()
        sync_cnt = 0
        skip_cnt = 0

        for g in guidelines:
            exists = (
                session.query(ProcessDocument)
                .filter_by(original_text=g.control_text)
                .first()
            )
            if exists:
                skip_cnt += 1
                continue

            doc = ProcessDocument(
                original_text=g.control_text,
                category=g.category,
                standard=g.standard,
                processed_text="",
                subject=SubjectEnum.unknown,
                phase=PhaseEnum.unknown,
                priority=PriorityEnum.unknown,
                role=RoleEnum.unknown,
                status=StatusEnum.not_started,
            )
            session.add(doc)
            sync_cnt += 1

        session.commit()
        return {"sync": sync_cnt, "skip": skip_cnt}

    sync_result = _sync_db(db)

    loop = asyncio.get_event_loop()
    # run_in_executor によって、blocking_task は別スレッドで実行される
    loop.run_in_executor(executor, process_task, process_all)

    await invalidate_cache("process:all")
    await invalidate_cache("process:count")
    await invalidate_cache("process:standards")
    await invalidate_cache("process:categories")

    return {
        "sync_count": sync_result["sync"],
        "skip_count": sync_result["skip"],
    }


@router.get("/list", response_model=List[ClusterSchema])
@cache(expire=REDIS_TTL, namespace="process:all")
async def list_clusters(
    subject: Optional[SubjectEnum] = Query(None),
    phase: Optional[PhaseEnum] = Query(None),
    priority: Optional[PriorityEnum] = Query(None),
    status: Optional[StatusEnum] = Query(None),
    role: Optional[RoleEnum] = Query(None),
    category: Optional[str] = Query(None),
    standard: Optional[str] = Query(None),
    skip: int = Query(0),
    limit: int = Query(50),  # デフォルトリミットを50に削減
    db: Session = Depends(get_db),
):
    try:
        # Start with base query
        query = db.query(ProcessCluster)
        
        # Apply filters if any are provided
        if any([subject, phase, priority, status, role, category, standard]):
            # Join with documents for filtering
            query = query.join(ProcessCluster.documents)
            if subject:
                query = query.filter(ProcessDocument.subject == subject)
            if phase:
                query = query.filter(ProcessDocument.phase == phase)
            if priority:
                query = query.filter(ProcessDocument.priority == priority)
            if status:
                query = query.filter(ProcessDocument.status == status)
            if role:
                query = query.filter(ProcessDocument.role == role)
            if category:
                query = query.filter(ProcessDocument.category == category)
            if standard:
                query = query.filter(ProcessDocument.standard == standard)
            
            # Use distinct to avoid duplicates when joining
            query = query.distinct(ProcessCluster.id)

        # Apply pagination and eager loading
        clusters = (
            query.options(joinedload(ProcessCluster.documents))
            .order_by(ProcessCluster.id)
            .offset(skip)
            .limit(limit)
            .all()
        )
    except Exception as e:
        logger.error(f"Error in list_clusters query: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")

    return [
        {
            "cluster_id": cluster.id,
            "rep_text": cluster.rep_text,
            "documents": [
                {
                    "id": doc.id,
                    "original_text": doc.original_text,
                    "processed_text": doc.processed_text,
                    "priority": doc.priority,
                    "phase": doc.phase,
                    "status": doc.status,
                    "role": doc.role,
                    "category": doc.category,
                    "standard": doc.standard,
                    "subject": doc.subject,
                    "cluster_id": doc.cluster_id,
                }
                for doc in cluster.documents
            ],
        }
        for cluster in clusters
    ]


@router.get("/count", response_model=int)
@cache(expire=REDIS_TTL, namespace="process:count")
async def count_clusters(
    subject: Optional[SubjectEnum] = Query(None),
    phase: Optional[PhaseEnum] = Query(None),
    priority: Optional[PriorityEnum] = Query(None),
    status: Optional[StatusEnum] = Query(None),
    role: Optional[RoleEnum] = Query(None),
    category: Optional[str] = Query(None),
    standard: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(ProcessCluster.id)

    if any([subject, phase, priority, status, role]):
        query = query.join(ProcessCluster.documents)
        if subject:
            query = query.filter(ProcessDocument.subject == subject)
        if phase:
            query = query.filter(ProcessDocument.phase == phase)
        if priority:
            query = query.filter(ProcessDocument.priority == priority)
        if status:
            query = query.filter(ProcessDocument.status == status)
        if role:
            query = query.filter(ProcessDocument.role == role)
        if category:
            query = query.filter(ProcessDocument.category == category)
        if standard:
            query = query.filter(ProcessDocument.standard == standard)

    return query.distinct().count()


@router.get("/matrix")
@cache(expire=REDIS_TTL, namespace="process:matrix")
async def get_process_matrix(
    subject: Optional[SubjectEnum] = Query(None),
    category: Optional[str] = Query(None),
    standard: Optional[str] = Query(None),
    priority: Optional[PriorityEnum] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Get process matrix data for all phase/role combinations with given filters.
    Returns a matrix with counts for each phase/role combination.
    """
    try:
        matrix = {}
        
        # Initialize matrix structure
        for phase in PhaseEnum:
            if phase != PhaseEnum.unknown:
                matrix[phase.value] = {}
                for role in RoleEnum:
                    if role != RoleEnum.unknown:
                        matrix[phase.value][role.value] = 0
        
        # Build a single query to get all counts efficiently
        query = (
            db.query(
                ProcessDocument.phase,
                ProcessDocument.role,
                func.count(ProcessCluster.id.distinct()).label('count')
            )
            .join(ProcessCluster, ProcessDocument.cluster_id == ProcessCluster.id)
            .filter(
                ProcessDocument.phase != PhaseEnum.unknown,
                ProcessDocument.role != RoleEnum.unknown
            )
        )
        
        # Apply filters
        if subject:
            query = query.filter(ProcessDocument.subject == subject)
        if category:
            query = query.filter(ProcessDocument.category == category)
        if standard:
            query = query.filter(ProcessDocument.standard == standard)
        if priority:
            query = query.filter(ProcessDocument.priority == priority)
        
        # Group by phase and role
        query = query.group_by(ProcessDocument.phase, ProcessDocument.role)
        
        # Execute query and populate matrix
        results = query.all()
        for phase, role, count in results:
            if phase.value in matrix and role.value in matrix[phase.value]:
                matrix[phase.value][role.value] = count
        
        return matrix
        
    except Exception as e:
        logger.error(f"Error in get_process_matrix: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to generate process matrix: {str(e)}"
        )


@router.get("/standards", response_model=List[str])
@cache(expire=REDIS_TTL, namespace="process:standards")
async def get_standards(db: Session = Depends(get_db)):
    results = db.query(ProcessDocument.standard).distinct().all()
    standards = [row[0] for row in results if row[0] is not None]
    return standards


@router.get("/categories", response_model=List[str])
@cache(expire=REDIS_TTL, namespace="process:categories")
async def get_categories(db: Session = Depends(get_db)):
    results = db.query(ProcessDocument.category).distinct().all()
    categories = [row[0] for row in results if row[0] is not None]
    return categories


@router.put("/cluster/{cluster_id}")
async def update_cluster_representative(
    cluster_id: str, new_text: str, db: Session = Depends(get_db)
):
    cluster = db.query(ProcessCluster).filter(ProcessCluster.id == cluster_id).first()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    cluster.rep_text = new_text
    db.commit()
    await invalidate_cache("process:all")
    return {"message": "Representative text updated", "cluster_id": cluster_id}


@router.post("/cluster/update")
async def update_all_representative(db: Session = Depends(get_db)):
    clusters = db.query(ProcessCluster).all()
    if not clusters:
        raise HTTPException(status_code=404, detail="Cluster not found")
    upd_cnt = 0
    skip_cnt = 0
    for cluster in clusters:
        rep_doc = (
            db.query(ProcessDocument)
            .filter(ProcessDocument.cluster_id == cluster.id)
            .first()
        )

        if rep_doc is None:
            logger.info(f"[DEBUG] No Document in (id={cluster.id})")
            skip_cnt += 1
            continue

        cluster.rep_text = rep_doc.processed_text
        upd_cnt += 1

    try:
        db.commit()
        print("[DEBUG] DB commit ok")
    except Exception as e:
        print(f"[ERROR] DB commit: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="DB commit error")

    await invalidate_cache("process:all")
    return {
        "message": "Representative text updated",
        "update": upd_cnt,
        "skipped": skip_cnt,
    }


@router.post("/projects", response_model=dict)
async def create_assessment_project(
    request: Request,
    name: str = Body(...),
    description: str = Body(""),
    subject: Optional[str] = Body(None),
    phase: Optional[str] = Body(None),
    role: Optional[str] = Body(None),
    priority: Optional[str] = Body(None),
    category: Optional[str] = Body(None),
    standard: Optional[str] = Body(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_admin_user),
):
    """Create a new assessment project with filtered data (admin only)"""

    project = AssessmentProject(
        name=name,
        description=description,
        filter_subject=subject,
        filter_phase=phase,
        filter_role=role,
        filter_priority=priority,
        filter_category=category,
        filter_standard=standard,
    )
    db.add(project)
    db.flush()  # Get the project ID

    query = db.query(ProcessDocument)
    if subject:
        query = query.filter(ProcessDocument.subject == subject)
    if phase:
        query = query.filter(ProcessDocument.phase == phase)
    if role:
        query = query.filter(ProcessDocument.role == role)
    if priority:
        query = query.filter(ProcessDocument.priority == priority)
    if category:
        query = query.filter(ProcessDocument.category == category)
    if standard:
        query = query.filter(ProcessDocument.standard == standard)

    documents = query.all()

    assessment_count = 0
    for doc in documents:
        assessment = Assessment(
            project_id=project.id, document_id=doc.id, status=StatusEnum.not_started
        )
        db.add(assessment)
        assessment_count += 1

    db.commit()

    return {
        "project_id": project.id,
        "name": name,
        "assessment_count": assessment_count,
        "message": "Assessment project created successfully",
    }


@router.get("/projects", response_model=List[dict])
async def list_assessment_projects(
    skip: int = Query(0), limit: int = Query(100), db: Session = Depends(get_db)
):
    """List all assessment projects"""
    projects = (
        db.query(AssessmentProject)
        .order_by(AssessmentProject.id)
        .offset(skip)
        .limit(limit)
        .all()
    )

    result = []
    for project in projects:
        assessment_counts = (
            db.query(Assessment.status, func.count(Assessment.id).label("cnt"))
            .filter(Assessment.project_id == project.id)
            .group_by(Assessment.status)
            .all()
        )

        status_counts = {status.value: 0 for status in StatusEnum}
        for status, count in assessment_counts:
            status_counts[status.value] = count

        result.append(
            {
                "id": project.id,
                "name": project.name,
                "description": project.description,
                "created_at": project.created_at,
                "filter_criteria": {
                    "subject": project.filter_subject,
                    "phase": project.filter_phase,
                    "role": project.filter_role,
                    "priority": project.filter_priority,
                    "category": project.filter_category,
                    "standard": project.filter_standard,
                },
                "status_counts": status_counts,
                "total_assessments": sum(status_counts.values()),
            }
        )

    return result


@router.get("/projects/{project_id}", response_model=dict)
@cache(expire=300)  # 5分間キャッシュ
async def get_assessment_project(
    project_id: str,
    db: Session = Depends(get_db),
):
    """Get a specific assessment project"""
    project = (
        db.query(AssessmentProject).filter(AssessmentProject.id == project_id).first()
    )

    if not project:
        raise HTTPException(status_code=404, detail="Assessment project not found")

    # Get assessment counts for status summary with optimized query
    assessment_counts = (
        db.query(Assessment.status, func.count(Assessment.id).label("cnt"))
        .filter(Assessment.project_id == project.id)
        .group_by(Assessment.status)
        .all()
    )

    status_counts = {status.value: 0 for status in StatusEnum}
    for status, count in assessment_counts:
        status_counts[status.value] = count

    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "created_at": project.created_at,
        "filter_criteria": {
            "subject": project.filter_subject,
            "phase": project.filter_phase,
            "role": project.filter_role,
            "priority": project.filter_priority,
            "category": project.filter_category,
            "standard": project.filter_standard,
        },
        "status_counts": status_counts,
        "total_assessments": sum(status_counts.values()),
    }


@router.get("/projects/{project_id}/assessments", response_model=List[dict])
@cache(expire=180)  # 3分間キャッシュ
async def get_project_assessments(
    project_id: str,
    status: Optional[StatusEnum] = Query(None),
    skip: int = Query(0),
    limit: int = Query(50),  # デフォルトリミットを50に削減
    db: Session = Depends(get_db),
):
    """Get assessments for a specific project"""
    # Eagerly load document data to avoid N+1 queries
    query = (
        db.query(Assessment)
        .join(ProcessDocument)
        .filter(Assessment.project_id == project_id)
    )

    if status:
        query = query.filter(Assessment.status == status)

    # Optimize with eager loading
    assessments = (
        query.options(joinedload(Assessment.document))
        .order_by(Assessment.id)
        .offset(skip)
        .limit(limit)
        .all()
    )

    result = []
    for assessment in assessments:
        result.append(
            {
                "id": assessment.id,
                "document_id": assessment.document_id,
                "status": assessment.status,
                "notes": assessment.notes,
                "assessed_at": assessment.assessed_at,
                "document": {
                    "id": assessment.document.id,
                    "original_text": assessment.document.original_text,
                    "processed_text": assessment.document.processed_text,
                    "category": assessment.document.category,
                    "standard": assessment.document.standard,
                    "subject": assessment.document.subject,
                    "phase": assessment.document.phase,
                    "role": assessment.document.role,
                    "priority": assessment.document.priority,
                },
            }
        )

    return result


@router.get("/projects/{project_id}/assessments/count")
@cache(expire=300)  # 5分間キャッシュ
async def get_project_assessments_count(
    project_id: str,
    status: Optional[StatusEnum] = Query(None),
    db: Session = Depends(get_db),
):
    """Get assessment count for a specific project"""
    query = db.query(Assessment).filter(Assessment.project_id == project_id)

    if status:
        query = query.filter(Assessment.status == status)

    total = query.count()
    return {"total": total}


@router.put("/assessments/{assessment_id}/status", response_model=dict)
async def update_assessment_status(
    assessment_id: str,
    status: StatusEnum = Body(...),
    notes: Optional[str] = Body(None),
    db: Session = Depends(get_db),
):
    """Update assessment status"""
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()

    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    assessment.status = status
    if notes is not None:
        assessment.notes = notes
    assessment.assessed_at = datetime.utcnow()

    db.commit()

    return {
        "assessment_id": assessment_id,
        "status": status,
        "message": "Assessment status updated successfully",
    }


@router.delete("/projects/{project_id}", response_model=dict)
async def delete_assessment_project(
    project_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(get_admin_user),
):
    """Delete an assessment project and all related assessments (admin only)"""
    project = (
        db.query(AssessmentProject).filter(AssessmentProject.id == project_id).first()
    )

    if not project:
        raise HTTPException(status_code=404, detail="Assessment project not found")

    db.query(Assessment).filter(Assessment.project_id == project_id).delete()

    db.delete(project)
    db.commit()

    return {
        "message": "Assessment project deleted successfully",
        "project_id": project_id,
    }
