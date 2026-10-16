"""
Data models for the Attendly application.
"""

from pydantic import BaseModel
from typing import Optional
from enum import Enum


class AttendanceStatus(str, Enum):
    PRESENT = "P"
    ABSENT = "A"
    NOT_UPDATED = "NU"
    EXEMPTION = "E"
    LATE_ADMISSION = "L"


class StudentMetadata(BaseModel):
    student_name: str
    student_number: Optional[str] = None
    roll_number: Optional[str] = None
    academic_year: Optional[str] = None
    semester: Optional[str] = None
    program: Optional[str] = None
    report_start_date: Optional[str] = None
    report_end_date: Optional[str] = None
    institution: Optional[str] = None
    latest_record_date: Optional[str] = None
    earliest_record_date: Optional[str] = None


class AttendanceRecord(BaseModel):
    id: Optional[int] = None
    serial_number: int
    course_raw: str
    course_normalized: str
    date: str  # ISO format YYYY-MM-DD
    start_time: str  # HH:MM:SS
    end_time: str  # HH:MM:SS
    status: str  # P, A, NU, E, L


class SubjectSummary(BaseModel):
    course_name: str
    present: int
    absent: int
    not_updated: int
    counted: int  # present + absent (excludes NU)
    percentage: Optional[float] = None  # null if counted == 0


class OverallSummary(BaseModel):
    total_present: int
    total_absent: int
    total_not_updated: int
    total_counted: int
    overall_percentage: Optional[float] = None
    subjects_tracked: int


class AttendanceDataset(BaseModel):
    metadata: StudentMetadata
    records: list[AttendanceRecord]
    subjects: list[SubjectSummary]
    overall: OverallSummary
    imported_at: str  # ISO datetime
    source_filename: Optional[str] = None


class UploadResponse(BaseModel):
    success: bool
    message: str
    dataset: Optional[AttendanceDataset] = None
    error: Optional[str] = None
    records_count: Optional[int] = None


class SubjectDetailResponse(BaseModel):
    summary: SubjectSummary
    records: list[AttendanceRecord]
