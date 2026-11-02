from pydantic import BaseModel
from typing import Optional


PIPELINE_STAGES = [
    "Watching",
    "Shortlisted",
    "Applied",
    "Screen",
    "Interviewing",
    "Offer",
    "Rejected",
    "Auto Rejected",
    "Ghosted",
]

FIT_LEVELS = ["High", "Medium", "Low", "Unknown"]


class JobBase(BaseModel):
    company: str
    job_title: str
    location: Optional[str] = None
    company_size: Optional[str] = None
    salary: Optional[str] = None
    role_requirements: Optional[str] = None
    pipeline_stage: str = "Shortlisted"
    fit_level: str = "Unknown"
    why_it_fits: Optional[str] = None
    careers_page_url: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None
    product_description: Optional[str] = None
    logo_url: Optional[str] = None


class JobCreate(JobBase):
    pass


class JobUpdate(BaseModel):
    company: Optional[str] = None
    job_title: Optional[str] = None
    location: Optional[str] = None
    company_size: Optional[str] = None
    salary: Optional[str] = None
    role_requirements: Optional[str] = None
    pipeline_stage: Optional[str] = None
    fit_level: Optional[str] = None
    why_it_fits: Optional[str] = None
    careers_page_url: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None
    product_description: Optional[str] = None
    logo_url: Optional[str] = None


class Job(JobBase):
    id: int
    created_at: str
    updated_at: str
    status_changed_at: Optional[str] = None

    class Config:
        from_attributes = True


class ExtractRequest(BaseModel):
    url: str


class ExtractResponse(BaseModel):
    company: Optional[str] = None
    job_title: Optional[str] = None
    location: Optional[str] = None
    company_size: Optional[str] = None
    salary: Optional[str] = None
    role_requirements: Optional[str] = None
    fit_level: Optional[str] = None
    why_it_fits: Optional[str] = None
    product_description: Optional[str] = None
    careers_page_url: Optional[str] = None
    logo_url: Optional[str] = None
    raw_error: Optional[str] = None
