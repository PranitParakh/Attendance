"""
SQLite database layer for local persistence.

Stores the current attendance dataset so that refreshing the browser
does not lose imported data. No authentication or multi-user support.
"""

import sqlite3
import os
from datetime import datetime, timezone
from typing import Optional

from app.models import StudentMetadata, AttendanceRecord

# Database file location - in the backend directory
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "attendly.db")


def get_connection() -> sqlite3.Connection:
    """Get a SQLite connection with row factory and generous timeout."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout=30000")
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Initialize the database schema."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS datasets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_name TEXT NOT NULL,
            student_number TEXT,
            roll_number TEXT,
            academic_year TEXT,
            semester TEXT,
            program TEXT,
            report_start_date TEXT,
            report_end_date TEXT,
            institution TEXT,
            source_filename TEXT,
            imported_at TEXT NOT NULL,
            is_current INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS attendance_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dataset_id INTEGER NOT NULL,
            serial_number INTEGER NOT NULL,
            course_raw TEXT NOT NULL,
            course_normalized TEXT NOT NULL,
            date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            status TEXT NOT NULL,
            FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_records_dataset
            ON attendance_records(dataset_id);
        CREATE INDEX IF NOT EXISTS idx_records_course
            ON attendance_records(course_normalized);
        CREATE INDEX IF NOT EXISTS idx_records_date
            ON attendance_records(date);
    """)

    conn.commit()
    conn.close()


def delete_all_datasets() -> int:
    """
    Delete ALL datasets and their attendance records from the database.
    Used before a fresh import to ensure a clean state — prevents
    historical datasets from accumulating across re-uploads.

    Returns:
        Number of datasets deleted
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) AS cnt FROM datasets")
    count = cursor.fetchone()["cnt"]
    # CASCADE handles attendance_records deletion
    cursor.execute("DELETE FROM datasets")
    conn.commit()
    conn.close()
    return count


def save_dataset(
    metadata: StudentMetadata,
    records: list[AttendanceRecord],
    filename: str = None
) -> int:
    """
    Save a parsed attendance dataset to the database.
    First wipes ALL existing datasets to ensure a clean state,
    then inserts the new dataset as current.

    Returns:
        The dataset ID
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Wipe all existing datasets (and their records via CASCADE)
    # to prevent accumulation across re-uploads.
    cursor.execute("DELETE FROM datasets")

    # Insert the new dataset
    imported_at = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
        INSERT INTO datasets (
            student_name, student_number, roll_number,
            academic_year, semester, program,
            report_start_date, report_end_date, institution,
            source_filename, imported_at, is_current
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    """, (
        metadata.student_name,
        metadata.student_number,
        metadata.roll_number,
        metadata.academic_year,
        metadata.semester,
        metadata.program,
        metadata.report_start_date,
        metadata.report_end_date,
        metadata.institution,
        filename,
        imported_at,
    ))

    dataset_id = cursor.lastrowid

    # Insert all records
    record_data = [
        (
            dataset_id,
            r.serial_number,
            r.course_raw,
            r.course_normalized,
            r.date,
            r.start_time,
            r.end_time,
            r.status,
        )
        for r in records
    ]

    cursor.executemany("""
        INSERT INTO attendance_records (
            dataset_id, serial_number, course_raw, course_normalized,
            date, start_time, end_time, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, record_data)

    conn.commit()
    conn.close()

    return dataset_id


def get_current_dataset() -> Optional[dict]:
    """
    Get the current (most recently imported) dataset.

    Returns:
        Dict with 'metadata' and 'records', or None if no dataset exists
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Get current dataset metadata
    cursor.execute("""
        SELECT * FROM datasets WHERE is_current = 1 ORDER BY id DESC LIMIT 1
    """)
    dataset_row = cursor.fetchone()

    if not dataset_row:
        conn.close()
        return None

    dataset_id = dataset_row["id"]

    metadata = StudentMetadata(
        student_name=dataset_row["student_name"],
        student_number=dataset_row["student_number"],
        roll_number=dataset_row["roll_number"],
        academic_year=dataset_row["academic_year"],
        semester=dataset_row["semester"],
        program=dataset_row["program"],
        report_start_date=dataset_row["report_start_date"],
        report_end_date=dataset_row["report_end_date"],
        institution=dataset_row["institution"],
    )

    # Get all records for this dataset
    cursor.execute("""
        SELECT * FROM attendance_records
        WHERE dataset_id = ?
        ORDER BY serial_number
    """, (dataset_id,))

    records = []
    for row in cursor.fetchall():
        records.append(AttendanceRecord(
            id=row["id"],
            serial_number=row["serial_number"],
            course_raw=row["course_raw"],
            course_normalized=row["course_normalized"],
            date=row["date"],
            start_time=row["start_time"],
            end_time=row["end_time"],
            status=row["status"],
        ))

    valid_dates = [r.date for r in records if r.date]
    if valid_dates:
        metadata.latest_record_date = max(valid_dates)
        metadata.earliest_record_date = min(valid_dates)

    conn.close()

    return {
        "metadata": metadata,
        "records": records,
        "imported_at": dataset_row["imported_at"],
        "source_filename": dataset_row["source_filename"],
    }


def delete_current_dataset() -> bool:
    """
    Completely wipe all datasets and attendance records from the database.
    Guarantees 100% database reset across all sessions.

    Returns:
        True if any records or datasets existed and were deleted, False if already empty
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as cnt FROM datasets")
        row = cursor.fetchone()
        count = row["cnt"] if row else 0

        cursor.execute("DELETE FROM attendance_records")
        cursor.execute("DELETE FROM datasets")
        conn.commit()
        return count > 0
    finally:
        conn.close()
