from fastapi import APIRouter, HTTPException
from models import JobCreate, JobUpdate, Job
import database as db

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("/", response_model=list[Job])
def list_jobs():
    return db.get_all_jobs()


@router.get("/{job_id}", response_model=Job)
def get_job(job_id: int):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/", response_model=Job, status_code=201)
def create_job(payload: JobCreate):
    return db.create_job(payload.model_dump())


@router.patch("/{job_id}", response_model=Job)
def update_job(job_id: int, payload: JobUpdate):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return db.update_job(job_id, payload.model_dump(exclude_none=True))


@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: int):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete_job(job_id)
