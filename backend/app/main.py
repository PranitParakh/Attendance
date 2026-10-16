"""
Attendly - FastAPI Backend

Main application entry point with API endpoints for
attendance PDF upload, parsing, and data retrieval.
"""

import os
import sys
import asyncio
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import unquote

# Fix for Playwright subprocess error on Windows with Uvicorn
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.models import (
    AttendanceDataset, AttendanceRecord, SubjectSummary,
    OverallSummary, UploadResponse, SubjectDetailResponse,
)
from app.parser import parse_attendance_pdf
from app.calculator import calculate_subject_summaries, calculate_overall_summary
from app.database import init_db, save_dataset, get_current_dataset, delete_current_dataset


# Configuration
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {".pdf"}


app = FastAPI(
    title="Attendly API",
    description="Local attendance analytics for NMIMS students",
    version="1.0.0",
)

# CORS - allow local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    """Initialize database on startup."""
    init_db()


@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "attendly"}


@app.post("/api/attendance/upload", response_model=UploadResponse)
async def upload_attendance(file: UploadFile = File(...)):
    """
    Upload and parse an NMIMS attendance PDF.

    Accepts a PDF file, parses it to extract attendance records,
    normalizes course names, calculates statistics, and stores
    the dataset in the local SQLite database.
    """
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    _, ext = os.path.splitext(file.filename.lower())
    if ext not in ALLOWED_EXTENSIONS:
        return UploadResponse(
            success=False,
            message="Invalid file type",
            error=f"Expected a PDF file, got '{ext}'. Please upload a .pdf file.",
        )

    # Read file content
    try:
        content = await file.read()
    except Exception as e:
        return UploadResponse(
            success=False,
            message="Failed to read file",
            error=str(e),
        )

    # Check file size
    if len(content) > MAX_UPLOAD_SIZE:
        return UploadResponse(
            success=False,
            message="File too large",
            error=f"Maximum file size is {MAX_UPLOAD_SIZE // (1024*1024)} MB",
        )

    if len(content) == 0:
        return UploadResponse(
            success=False,
            message="Empty file",
            error="The uploaded file is empty.",
        )

    # Parse PDF
    try:
        metadata, records = parse_attendance_pdf(content, file.filename)
    except ValueError as e:
        return UploadResponse(
            success=False,
            message="Unable to read this attendance report",
            error=str(e),
        )
    except Exception as e:
        return UploadResponse(
            success=False,
            message="An unexpected error occurred while parsing the PDF",
            error=str(e),
        )

    # Calculate statistics
    subjects = calculate_subject_summaries(records)
    overall = calculate_overall_summary(records, subjects)

    # Sanitize filename
    safe_filename = os.path.basename(file.filename)

    # Save to database
    try:
        save_dataset(metadata, records, safe_filename)
    except Exception as e:
        return UploadResponse(
            success=False,
            message="Failed to save dataset",
            error=str(e),
        )

    # Build response
    dataset = AttendanceDataset(
        metadata=metadata,
        records=records,
        subjects=subjects,
        overall=overall,
        imported_at=datetime.now(timezone.utc).isoformat(),
        source_filename=safe_filename,
    )

    return UploadResponse(
        success=True,
        message="Attendance imported successfully",
        dataset=dataset,
        records_count=len(records),
    )

class FetchRequest(BaseModel):
    username: str
    password: str
    headless: Optional[bool] = False

@app.post("/api/attendance/fetch", response_model=UploadResponse)
async def fetch_attendance(req: FetchRequest):
    """
    Automate fetching the attendance PDF from the SAP Portal,
    then parses and saves it just like a manual upload.
    """
    try:
        from app.scraper import run_scraper_in_proactor_loop
        pdf_bytes = await asyncio.to_thread(
            run_scraper_in_proactor_loop,
            req.username,
            req.password,
            bool(req.headless)
        )
    except Exception as e:
        return UploadResponse(
            success=False,
            message="Failed to fetch from portal",
            error=str(e),
        )

    try:
        metadata, records = parse_attendance_pdf(
            pdf_bytes, "portal_fetch.pdf", skip_institution_check=True
        )
    except ValueError as e:
        return UploadResponse(
            success=False,
            message="Unable to read the fetched report",
            error=str(e),
        )
    except Exception as e:
        return UploadResponse(
            success=False,
            message="An unexpected error occurred while parsing",
            error=str(e),
        )

    subjects = calculate_subject_summaries(records)
    overall = calculate_overall_summary(records, subjects)

    try:
        save_dataset(metadata, records, "portal_fetch.pdf")
    except Exception as e:
        return UploadResponse(
            success=False,
            message="Failed to save dataset",
            error=str(e),
        )

    dataset = AttendanceDataset(
        metadata=metadata,
        records=records,
        subjects=subjects,
        overall=overall,
        imported_at=datetime.now(timezone.utc).isoformat(),
        source_filename="portal_fetch.pdf",
    )

    return UploadResponse(
        success=True,
        message="Attendance fetched and imported successfully",
        dataset=dataset,
        records_count=len(records),
    )


@app.get("/api/attendance/current")
def get_current_attendance():
    """
    Get the current (most recently imported) attendance dataset.
    Returns the full dataset with calculated statistics.
    """
    data = get_current_dataset()
    if not data:
        raise HTTPException(
            status_code=404,
            detail="No attendance data found. Please upload a PDF first."
        )

    metadata = data["metadata"]
    records = data["records"]

    subjects = calculate_subject_summaries(records)
    overall = calculate_overall_summary(records, subjects)

    return AttendanceDataset(
        metadata=metadata,
        records=records,
        subjects=subjects,
        overall=overall,
        imported_at=data["imported_at"],
        source_filename=data.get("source_filename"),
    )


@app.get("/api/attendance/subjects")
def get_subjects():
    """Get a list of all subjects with their attendance summaries."""
    data = get_current_dataset()
    if not data:
        raise HTTPException(
            status_code=404,
            detail="No attendance data found. Please upload a PDF first."
        )

    subjects = calculate_subject_summaries(data["records"])
    return {"subjects": subjects}


@app.get("/api/attendance/subjects/{subject_name}")
def get_subject_detail(subject_name: str):
    """
    Get detailed attendance data for a specific subject.
    Returns the subject summary and all individual records.
    """
    # URL decode the subject name
    decoded_name = unquote(subject_name)

    data = get_current_dataset()
    if not data:
        raise HTTPException(
            status_code=404,
            detail="No attendance data found. Please upload a PDF first."
        )

    records = data["records"]

    # Filter records for this subject
    subject_records = [
        r for r in records
        if r.course_normalized == decoded_name
    ]

    if not subject_records:
        raise HTTPException(
            status_code=404,
            detail=f"Subject '{decoded_name}' not found"
        )

    # Calculate summary for this subject
    subjects = calculate_subject_summaries(subject_records)
    if not subjects:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Sort records chronologically
    subject_records.sort(key=lambda r: (r.date, r.start_time))

    return SubjectDetailResponse(
        summary=subjects[0],
        records=subject_records,
    )


@app.delete("/api/attendance/current")
def delete_current():
    """Delete all attendance datasets and records (complete database wipe)."""
    delete_current_dataset()
    return {"success": True, "message": "All attendance data and records deleted"}
