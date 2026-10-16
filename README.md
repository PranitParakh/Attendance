# Attendly

A local, private web application for analyzing NMIMS SAP attendance reports. 

## Project Overview

Attendly is designed to provide students with a clear, accurate, and visually appealing dashboard for their attendance. It parses the system-generated PDF reports from SVKM/NMIMS SAP and dynamically calculates overall and subject-wise attendance statistics.

**Phase 1 is complete!**

### Key Features
* **Local First**: All processing happens entirely on your machine. No data is sent to external servers. No cloud databases.
* **Accurate Parsing**: Precisely extracts metadata (student name, roll number, etc.) and attendance records from the SAP PDF.
* **Course Normalization**: Intelligently strips section codes (e.g., T1, P1) and program suffixes (e.g., MBA Tech CE E) to group identical subjects correctly.
* **Precise Calculations**: 
    * "Not Updated" (NU) statuses are correctly excluded from percentage denominators.
    * Overall attendance is calculated accurately across all counted classes, *not* as an average of subject percentages.
* **Modern UI**: A responsive, premium dashboard built with React and Tailwind CSS, featuring glassmorphism and clear visual health indicators.
* **Data Persistence**: Uses a local SQLite database so you don't lose your imported data on a page refresh.

### Complete Documentation
For exhaustive line-by-line documentation, architectural breakdowns, formulas, and operational guides, visit the [**documentation/**](./documentation/README.md) folder:
* [00. System Architecture & Core Concepts](./documentation/00_SYSTEM_ARCHITECTURE_AND_CORE_CONCEPTS.md)
* [01. Backend Files Deep Dive](./documentation/01_BACKEND_FILES_DEEP_DIVE.md)
* [02. Frontend Core & Libraries](./documentation/02_FRONTEND_CORE_AND_LIBRARIES.md)
* [03. Frontend Pages & Components](./documentation/03_FRONTEND_PAGES_AND_COMPONENTS.md)
* [04. Scripts & Operations](./documentation/04_SCRIPTS_AND_OPERATIONS.md)
* [05. Codebase Cleanup & Unwanted Files](./documentation/05_CODEBASE_CLEANUP_AND_UNWANTED_FILES.md)
* [06. Dynamic Setup Action Plan](./documentation/06_ACTION_PLAN_DYNAMIC_SETUP.md)

---

## Architecture

The application follows a standard modular client-server architecture:

### Frontend
* **Framework**: React + TypeScript (Vite)
* **Styling**: Tailwind CSS v4
* **Routing**: React Router DOM
* **Icons**: Lucide React
* **Theme**: Custom minimal, premium aesthetics (glass panels, smooth animations)

### Backend
* **Framework**: Python + FastAPI
* **PDF Parsing**: PyMuPDF (fitz)
* **Database**: SQLite (via standard library)
* **Validation**: Pydantic

---

## Folder Structure

```
AttendanceCALCULATOR/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py        (FastAPI endpoints)
│   │   ├── models.py      (Pydantic schemas)
│   │   ├── parser.py      (PDF extraction logic)
│   │   ├── normalizer.py  (Course name cleanup)
│   │   ├── calculator.py  (Attendance math)
│   │   └── database.py    (SQLite persistence)
│   ├── tests/             (Comprehensive test suite)
│   ├── requirements.txt   (Python dependencies)
│   └── attendly.db        (Local SQLite database - auto-generated)
├── frontend/
│   ├── src/
│   │   ├── components/    (Reusable UI components)
│   │   ├── lib/           (API client, types)
│   │   ├── pages/         (Route components: Home, Dashboard, SubjectDetail)
│   │   ├── App.tsx        (Router setup)
│   │   ├── main.tsx       (React entry)
│   │   └── index.css      (Tailwind & custom styles)
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts     (Vite config with proxy to backend)
└── test_data.pdf          (Reference PDF for testing)
```

---

## How It Works

### PDF Parsing
The backend uses PyMuPDF to extract text from the uploaded PDF. It identifies the first page header to extract student metadata. It then scans all pages line-by-line looking for integer serial numbers to identify attendance rows, extracting the date, time, and status.

### Course Normalization
NMIMS SAP PDFs append section data to course names (e.g., `DATA STRUCT&ALGORITHMST1 MBA T CE E`). The `normalizer.py` module uses regex patterns to strip these suffixes and maps known abbreviations (like `DATA STRUCT&ALGORITHMS`) to their full, clean names (like `DATA STRUCTURES & ALGORITHMS`).

### Attendance Calculations
* **Present (P)**: Adds 1 to present, 1 to counted.
* **Absent (A)**: Adds 1 to absent, 1 to counted.
* **Not Updated (NU)**: Adds 1 to not_updated, 0 to counted.
* **Percentage**: `(Present / Counted) * 100`

---

## Installation & Startup

### 1. Backend

Open a terminal in the `backend` directory:

```bash
cd backend
python -m venv .venv
# Activate the virtual environment
# Windows:
.venv\Scripts\activate
# Mac/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn app.main:app --reload
```
The backend API will run at `http://127.0.0.1:8000`.

### 2. Frontend

Open a separate terminal in the `frontend` directory:

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```
The frontend will run at `http://localhost:5173`. Open this URL in your browser.

---

## Testing

The backend includes a comprehensive test suite covering parser edge cases, calculation rules, and course normalization.

To run the tests, ensure your virtual environment is active in the `backend` folder:
```bash
pip install pytest
pytest tests/ -v
```

---

## Known Limitations (Phase 1)
* The parser strictly expects the SVKM/NMIMS SAP standard attendance format. Major format changes by the university will require parser updates.
* Exemptions (E) and Late Admissions (L) are parsed but currently not actively factored into complex threshold calculations (they are ignored in the standard P/A percentage math).
* Requires a desktop-class modern browser for the best visual experience, though it is responsive.

## Future Phase 2 Features
* **Bunk Calculator**: Interactive tool to see how many classes you can skip while maintaining the 75% threshold.
* **Recovery Calculator**: Find out exactly how many consecutive classes you need to attend to recover from a low percentage.
* **Visual Timetable / Calendar**: Map attendance history to a visual weekly view.
* **Forecasting**: Predicting end-of-semester attendance based on current trends.
