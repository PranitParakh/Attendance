# Backend Files Deep Dive & Code Breakdown

This document provides a line-by-line and section-by-section breakdown of every file located inside `backend/app/` and `backend/tests/`. It is structured to explain the exact role, purpose, and function of every block of code.

---

## 1. `backend/app/models.py`

**Purpose**: Defines the data structures and schemas (Pydantic models) used by FastAPI to validate input and output data.

### Section-by-Section Breakdown

```python
from pydantic import BaseModel
from typing import Optional
from enum import Enum
```
- **Lines 5–7**: Imports `BaseModel` from Pydantic (provides automatic data validation and JSON serialization), `Optional` for fields that may be `None`, and `Enum` to define fixed constants.

```python
class AttendanceStatus(str, Enum):
    PRESENT = "P"
    ABSENT = "A"
    NOT_UPDATED = "NU"
    EXEMPTION = "E"
    LATE_ADMISSION = "L"
```
- **Lines 11–16**: Defines all recognized attendance statuses in the NMIMS system:
  - `P`: Student was present.
  - `A`: Student was absent.
  - `NU`: Session was conducted, but attendance is not yet updated by the faculty.
  - `E`: Medical / official exemption granted.
  - `L`: Late admission session.

```python
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
```
- **Lines 19–29**: Holds the metadata extracted from the top of the PDF report (Student Name, Roll No, SAP Student Number, Academic Year, etc.). If any optional header item is missing in the PDF, it defaults gracefully to `None`.

```python
class AttendanceRecord(BaseModel):
    id: Optional[int] = None
    serial_number: int
    course_raw: str
    course_normalized: str
    date: str  # ISO format YYYY-MM-DD
    start_time: str  # HH:MM:SS
    end_time: str  # HH:MM:SS
    status: str  # P, A, NU, E, L
```
- **Lines 31–40**: Represents a single attendance log entry (one row in the attendance table).
  - `course_raw`: Exact string printed in the PDF (e.g., `DATA STRUCT&ALGORITHMST1 MBA T CE E`).
  - `course_normalized`: Cleaned subject title (e.g., `DATA STRUCTURES & ALGORITHMS`).
  - `date`, `start_time`, `end_time`: Standardized ISO date (`YYYY-MM-DD`) and 24-hour time strings.

```python
class SubjectSummary(BaseModel):
    course_name: str
    present: int
    absent: int
    not_updated: int
    counted: int  # present + absent (excludes NU)
    percentage: Optional[float] = None  # null if counted == 0
```
- **Lines 42–49**: Summarized statistics for one subject across all sessions. `percentage` is `None` if zero counted sessions exist.

```python
class OverallSummary(BaseModel):
    total_present: int
    total_absent: int
    total_not_updated: int
    total_counted: int
    overall_percentage: Optional[float] = None
    subjects_tracked: int
```
- **Lines 51–58**: Aggregated totals across all subjects.

```python
class AttendanceDataset(BaseModel):
    metadata: StudentMetadata
    records: list[AttendanceRecord]
    subjects: list[SubjectSummary]
    overall: OverallSummary
    imported_at: str  # ISO datetime
    source_filename: Optional[str] = None
```
- **Lines 60–67**: The complete payload representing an imported attendance state.

```python
class UploadResponse(BaseModel):
    success: bool
    message: str
    dataset: Optional[AttendanceDataset] = None
    error: Optional[str] = None
    records_count: Optional[int] = None

class SubjectDetailResponse(BaseModel):
    summary: SubjectSummary
    records: list[AttendanceRecord]
```
- **Lines 69–80**: API response wrappers for PDF uploads/fetches and subject drill-down requests.

---

## 2. `backend/app/database.py`

**Purpose**: Implements the local SQLite persistence layer. Ensures imported attendance persists across browser refreshes and computer reboots.

### Section-by-Section Breakdown

```python
import sqlite3
import os
from datetime import datetime, timezone
from typing import Optional
from app.models import StudentMetadata, AttendanceRecord
```
- **Lines 8–17**: Standard library imports for SQLite operations, file paths, and timezone-aware timestamps.

```python
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "attendly.db")
```
- **Line 20**: Resolves the SQLite database file path to `backend/attendly.db`.

```python
def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn
```
- **Lines 23–30**: Opens a connection to SQLite.
  - `conn.row_factory = sqlite3.Row`: Allows accessing columns by name (like Python dictionaries).
  - `PRAGMA journal_mode=WAL`: Enables Write-Ahead Logging for high-performance concurrent reads and atomic writes.
  - `PRAGMA foreign_keys=ON`: Ensures foreign key constraints (like cascading deletes) are enforced.

```python
def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.executescript(""" ... """)
    conn.commit()
    conn.close()
```
- **Lines 32–77**: Runs on application startup. Creates `datasets` and `attendance_records` tables and creates performance indexes on `dataset_id`, `course_normalized`, and `date`.

```python
def save_dataset(metadata: StudentMetadata, records: list[AttendanceRecord], filename: str = None) -> int:
```
- **Lines 79–148**:
  - Updates any prior datasets: `UPDATE datasets SET is_current = 0`.
  - Inserts new row into `datasets` with current UTC timestamp and metadata fields.
  - Gets the newly generated `dataset_id = cursor.lastrowid`.
  - Batch-inserts all parsed attendance records via `cursor.executemany(...)` into `attendance_records`.
  - Commits transaction and returns the new `dataset_id`.

```python
def get_current_dataset() -> Optional[dict]:
```
- **Lines 150–212**: Retrieves the active dataset (`WHERE is_current = 1`). Reconstructs `StudentMetadata` and queries all child `attendance_records` sorted by serial number.

```python
def delete_current_dataset() -> bool:
```
- **Lines 214–239**: Finds the current dataset and deletes it. Thanks to `ON DELETE CASCADE`, SQLite automatically deletes all associated attendance rows.

---

## 3. `backend/app/calculator.py`

**Purpose**: Calculates subject summaries and overall statistics from parsed attendance records.

### Section-by-Section Breakdown

```python
def calculate_subject_summaries(records: list[AttendanceRecord]) -> list[SubjectSummary]:
```
- **Lines 23–77**:
  - Initializes a dictionary mapping each unique normalized course name to counters: `{"present": 0, "absent": 0, "not_updated": 0}`.
  - Iterates through all records:
    - If status == `"P"`, increments `present`.
    - If status == `"A"`, increments `absent`.
    - If status == `"NU"`, increments `not_updated`.
  - Calculates counted sessions as `present + absent` (omitting NU).
  - Calculates percentage as `round((present / counted) * 100, 2)` if counted > 0, else `None`.
  - Returns a list of `SubjectSummary` sorted alphabetically by course name.

```python
def calculate_overall_summary(records: list[AttendanceRecord], subjects: list[SubjectSummary]) -> OverallSummary:
```
- **Lines 79–116**:
  - Sums up all `present`, `absent`, and `not_updated` from all subjects.
  - Calculates `total_counted = total_present + total_absent`.
  - Calculates `overall_percentage = round((total_present / total_counted) * 100, 2)`.
  - Returns `OverallSummary`. Note: This ensures overall attendance is based on the pool of classes, not an average of percentages.

---

## 4. `backend/app/normalizer.py`

**Purpose**: Extracts clean, canonical course names from NMIMS SAP course strings.

### The Problem it Solves
NMIMS SAP generates strings containing batch codes, sections, and degree names crammed after the course title, for example:
- Raw: `DATA STRUCT&ALGORITHMST1 MBA T CE E`
- Normalized: `DATA STRUCTURES & ALGORITHMS`
- Raw: `DATA STRUCT&ALGORITHMS LABP1 MBAT CE E1`
- Normalized: `DATA STRUCTURES & ALGORITHMS LAB`

### Section-by-Section Breakdown

```python
SUFFIX_PATTERN = re.compile(
    r'([TPUL]\d)\s+(?:MBA|MBT|MBTCE|MBAT)'
)
```
- **Lines 37–39**: Matches section markers `[TPUL]\d` (e.g. `T1` for Theory 1, `P1` for Practical 1, `U1` for Tutorial 1, `L1` for Lab 1) followed by program indicators (`MBA`, `MBT`, etc.).

```python
ABBREVIATION_MAP = {
    "DATA STRUCT&ALGORITHMS": "DATA STRUCTURES & ALGORITHMS",
    "DATA STRUCT&ALGORITHMS LAB": "DATA STRUCTURES & ALGORITHMS LAB",
    "COMPUTER ORGANIZ&ARCHITECTUR": "COMPUTER ORGANIZATION & ARCHITECTURE",
    "MANAGEMENT ACCOU FOR ENGINE": "MANAGEMENT ACCOUNTING FOR ENGINEERS",
    "SIGNALS AND SYSTEMS": "SIGNALS AND SYSTEMS",
    "TECHNICAL COMMUNICATION": "TECHNICAL COMMUNICATION",
    "DISCRETE MATHEMATICS": "DISCRETE MATHEMATICS",
    "PROGRAMMING WITH PYTHON": "PROGRAMMING WITH PYTHON",
    "PROGRAMMING WITH PYTHON LAB": "PROGRAMMING WITH PYTHON LAB",
}
```
- **Lines 41–53**: Canonical dictionary converting truncated SAP names into official course names.

```python
def normalize_course_name(raw_course_name: str) -> str:
```
- **Lines 56–103**:
  - Strips leading/trailing whitespace.
  - Searches for `SUFFIX_PATTERN` to find where the metadata suffix starts, and cuts off the string before that point.
  - Fallback logic checks for direct `MBA`/`MBT` tokens if the section code was omitted.
  - Uppercases the course name and passes it to `_expand_abbreviation`.

```python
def _expand_abbreviation(course_name: str) -> str:
```
- **Lines 105–134**: Checks `ABBREVIATION_MAP`. Also handles whitespace normalization and ampersand variants (`&` vs `AND`).

```python
def get_section_type(raw_course_name: str) -> Optional[str]:
```
- **Lines 136–148**: Extracts whether the section was `'T'` (Theory), `'P'` (Practical), `'U'` (Tutorial), or `'L'` (Lab).

---

## 5. `backend/app/parser.py`

**Purpose**: Extracts text, metadata, and tabular records from uploaded or fetched NMIMS attendance PDFs using PyMuPDF (`fitz`).

### Section-by-Section Breakdown

```python
VALID_STATUSES = {"P", "A", "NU", "E", "L"}
MONTH_MAP = {"Jan": 1, "Feb": 2, ...}
DATE_PATTERN = re.compile(r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s+(\d{4})')
TIME_PATTERN = re.compile(r'(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)')
DURATION_PATTERN = re.compile(r'From\s+(\d{2}\.\d{2}\.\d{4})\s+to\s+(\d{2}\.\d{2}\.\d{4})')
```
- **Lines 42–66**: Pre-compiled regex patterns to parse dates (`Jul 13, 2026`), 12-hour timestamps (`11:00:01 AM`), and report durations (`From 01.07.2026 to 30.11.2026`).

```python
def parse_attendance_pdf(pdf_bytes: bytes, filename: str = "unknown.pdf", skip_institution_check: bool = False) -> tuple[StudentMetadata, list[AttendanceRecord]]:
```
- **Lines 68–134**:
  - Calls `_check_file_type` to guarantee the payload is a valid PDF (not HTML error pages or office docs).
  - Opens document using `fitz.open(stream=pdf_bytes, filetype="pdf")`.
  - Loops over each page, accumulating text into `page_texts` and `all_text`.
  - Validates document authenticity via `_is_nmims_attendance_pdf`.
  - Extracts student metadata from Page 1 header (`_extract_metadata`).
  - Scans full text to extract all attendance rows (`_extract_records`).
  - Raises descriptive `ValueError` if zero records are found.

```python
def _check_file_type(data: bytes, filename: str) -> None:
```
- **Lines 153–192**: Inspects magic bytes:
  - If header begins with `<!DOC` or `<html`, identifies that portal session expired and returned an HTML error.
  - If header begins with `\xd0\xcf\x11\xe0` or `PK`, alerts user that portal exported Word/Excel/Zip instead of PDF.
  - Rejects if it doesn't begin with `%PDF`.

```python
def _extract_metadata(first_page_text: str, all_text: str) -> StudentMetadata:
```
- **Lines 194–277**: Scans lines of Page 1. In PyMuPDF text extractions from SAP WebDynpro, field values precede or follow field labels:
  - Finds "Student Name", looks backwards for the student's name string.
  - Finds "Student Number", extracts digit string (SAP ID).
  - Finds "Roll No", extracts alphanumeric roll code (e.g. `B042`).
  - Finds "Academic Year", extracts year and semester.
  - Finds "Program Name", extracts degree name (e.g., `MBA Tech Computer Engineering`).

```python
def _extract_records(all_text: str) -> list[AttendanceRecord]:
```
- **Lines 280–327**: Scans all lines for integer serial numbers (1, 2, 3...). For each match, invokes `_try_parse_record` on the succeeding 6 lines.

```python
def _try_parse_record(lines: list[str], start_idx: int, sr_no: int) -> Optional[AttendanceRecord]:
```
- **Lines 329–388**: Validates that:
  - Line + 1 is course name.
  - Line + 2 matches `DATE_PATTERN`.
  - Line + 3 and Line + 4 match `TIME_PATTERN`.
  - Line + 5 matches `VALID_STATUSES`.
  - Converts date to `YYYY-MM-DD` and times to 24-hour `HH:MM:SS`.
  - Returns `AttendanceRecord`.

---

## 6. `backend/app/scraper.py`

**Purpose**: Automated Playwright scraper that bypasses portal friction, interacts with SAP WebDynpro UI, and intercepts the attendance report PDF.

### Key Architectural Techniques
1. **Pixel 7 Mobile Emulation**: Connecting with `p.devices["Pixel 7"]` triggers the responsive mobile portal layout, which omits desktop graphical CAPTCHA checks.
2. **Iframe Work Area**: The SAP attendance application runs inside a nested iframe titled `isolatedWorkArea`.
3. **WebDynpro Listbox Selection**: Interacts with dropdown inputs (`#WD2B` for Year, `#WD33` for Semester, `#WD39` for Report Type) to ensure the latest semester and "Detail Report" are chosen.
4. **Proactor Event Loop Isolation**: On Windows, Uvicorn runs an asyncio loop that can conflict with Playwright subprocesses. `run_scraper_in_proactor_loop` spins up a dedicated background worker thread with `WindowsProactorEventLoopPolicy`.
5. **Topmost Window Utility (`ensure_browser_topmost`)**: In headed mode, brings the Pixel 7 window to the foreground without disturbing maximized windows.

---

## 7. `backend/app/main.py`

**Purpose**: The central FastAPI application and REST API endpoints.

### Section-by-Section Breakdown

```python
app = FastAPI(title="Attendly API", description="Local attendance analytics for NMIMS students", version="1.0.0")
```
- **Lines 37–41**: Creates the FastAPI application instance.

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```
- **Lines 44–50**: Configures Cross-Origin Resource Sharing (CORS) to allow requests from the Vite frontend development server.

```python
@app.on_event("startup")
def startup():
    init_db()
```
- **Lines 53–56**: Automatically initializes SQLite database tables and indexes on launch.

```python
@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "attendly"}
```
- **Lines 59–62**: Health check endpoint for uptime monitoring and connectivity testing.

```python
@app.post("/api/attendance/upload", response_model=UploadResponse)
async def upload_attendance(file: UploadFile = File(...)):
```
- **Lines 65–160**:
  - Validates file extension is `.pdf` and size <= 10MB.
  - Calls `parse_attendance_pdf(content, file.filename)`.
  - Calculates subject and overall summaries.
  - Calls `save_dataset(...)` to persist to SQLite.
  - Returns `UploadResponse`.

```python
@app.post("/api/attendance/fetch", response_model=UploadResponse)
async def fetch_attendance(req: FetchRequest):
```
- **Lines 166–231**:
  - Takes `username`, `password`, and optional `headless` boolean.
  - Calls `run_scraper_in_proactor_loop` via `asyncio.to_thread`.
  - Parses the downloaded PDF bytes and saves to SQLite.
  - Returns updated `UploadResponse`.

```python
@app.get("/api/attendance/current")
def get_current_attendance():
```
- **Lines 233–260**: Fetches the currently active dataset from SQLite. Recomputes summaries and returns `AttendanceDataset`.

```python
@app.get("/api/attendance/subjects/{subject_name}")
def get_subject_detail(subject_name: str):
```
- **Lines 276–318**: URL-decodes `subject_name`, filters records belonging to that subject, sorts chronologically, and returns `SubjectDetailResponse`.

```python
@app.delete("/api/attendance/current")
def delete_current():
```
- **Lines 320–330**: Deletes the active dataset from SQLite.

---

## 8. `backend/tests/test_backend.py`

**Purpose**: Official test suite containing 47 unit tests covering normalization, PDF parsing, NU exclusion, and overall attendance math.
- Run command: `.venv\Scripts\pytest tests/test_backend.py` (Pass rate: 100%).
