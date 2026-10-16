# Project Knowledge Base

## 1. Project Overview

- **Purpose:** Attendly is a local, private web application for analyzing NMIMS SAP attendance reports.
- **Current status:** Phase 1 is complete.
- **Main features:** PDF parsing, course normalization, attendance calculations, local SQLite persistence, React dashboard, and automated SAP portal sync via Playwright.

## 2. Technology Stack

- **Languages:** Python 3.13 (backend), TypeScript ~6.0.2 (frontend).
- **Frameworks:**
  - Backend: FastAPI 0.115.6 with Uvicorn 0.34.0, Pydantic 2.10.4.
  - Frontend: React 19.3.0, React Router DOM 7.18.4, Vite 8.3.0, Tailwind CSS v4.3.3.
- **Runtimes and tools:**
  - Python virtual environment (`backend/.venv`).
  - Node.js 18+ with npm.
  - Playwright 1.49.1 (Chromium) for SAP portal automation.
  - PyMuPDF 1.25.3 (`fitz`) for PDF text extraction.
  - SQLite 3 (via `aiosqlite` 0.20.0) for local persistence.
- **Key dependencies (backend/requirements.txt):**
  - `fastapi==0.115.6`
  - `uvicorn[standard]==0.34.0`
  - `PyMuPDF==1.25.3`
  - `python-multipart==0.0.20`
  - `pydantic==2.10.4`
  - `aiosqlite==0.20.0`
  - `playwright==1.49.1`
- **Key dependencies (frontend/package.json):**
  - `react`, `react-dom` (^19.3.0)
  - `react-router-dom` (^7.18.4)
  - `pdfjs-dist` (^6.4.299) — Client-side in-browser PDF text and metadata parsing (zero backend required for PDF analysis)
  - `@tailwindcss/vite`, `tailwindcss` (^4.3.3)
  - `lucide-react` (^1.48.0)
  - `recharts` (^3.10.1)
  - Dev: `typescript` (~6.0.2), `@vitejs/plugin-react` (^6.1.1), `vite` (^8.3.0)
- **Deployment & Hosting:**
  - 100% Free Hosting Supported (Vercel, Cloudflare Pages, Netlify, GitHub Pages).
  - Pure client-side operation: parsing, normalization, curriculum configurations, NU simulations, and calculations run in the user's browser with local persistence.
  - Progressive Web App (PWA) readiness with `manifest.json`, responsive touch viewports for Android & PC.

## 3. Repository Structure

```
AttendanceCALCULATOR/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py            # FastAPI endpoints (upload, fetch, get current, subjects, delete)
│   │   ├── models.py          # Pydantic schemas (metadata, records, summaries, responses)
│   │   ├── parser.py          # PDF text extraction & record parsing (PyMuPDF)
│   │   ├── normalizer.py      # Course name normalization (strips section codes, expands abbreviations)
│   │   ├── calculator.py      # Attendance math (subject & overall summaries, NU exclusion)
│   │   ├── database.py        # SQLite persistence (datasets + attendance_records tables)
│   │   └── scraper.py         # Playwright automation for SAP portal login & PDF fetch
│   ├── tests/
│   │   ├── __init__.py
│   │   └── test_backend.py    # 47 backend tests (normalization, calculation, PDF parsing, invalid input)
│   ├── run_scraper.py         # CLI runner for standalone portal sync
│   ├── requirements.txt       # Python dependencies
│   ├── attendly.db            # Local SQLite database (auto-generated at runtime)
│   └── .venv/                 # Python virtual environment
├── frontend/
│   ├── src/
│   │   ├── components/        # Reusable UI components (Layout, UploadZone, cards, panels, modals)
│   │   ├── lib/               # types.ts, api.ts, subjectUtils.ts, analytics.ts
│   │   ├── pages/             # Home, Setup, Dashboard, SubjectDetail
│   │   ├── App.tsx            # React Router DOM setup
│   │   ├── main.tsx           # React entry point
│   │   └── index.css          # Tailwind v4 styles & custom CSS variables
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── vite.config.ts         # Vite config with /api proxy to localhost:8000
│   └── node_modules/
├── documentation/
│   ├── README.md              # Documentation index
│   ├── 00_SYSTEM_ARCHITECTURE_AND_CORE_CONCEPTS.md
│   ├── 01_BACKEND_FILES_DEEP_DIVE.md
│   ├── 02_FRONTEND_CORE_AND_LIBRARIES.md
│   ├── 03_FRONTEND_PAGES_AND_COMPONENTS.md
│   ├── 04_SCRIPTS_AND_OPERATIONS.md
│   ├── 05_CODEBASE_CLEANUP_AND_UNWANTED_FILES.md
│   ├── 06_ACTION_PLAN_DYNAMIC_SETUP.md
│   ├── PROJECT_KNOWLEDGE.md   # This file
│   └── CHANFGELOG.md          # Changelog
├── start_app.bat              # All-in-one launcher (backend + frontend + browser)
├── start_backend.bat          # Backend-only launcher
├── sync_portal.bat            # Standalone CLI portal sync
├── DEPLOYMENT_GUIDE.md        # Setup & deployment instructions
├── AGENT.md                   # AI agent protocol (project rules)
├── test_data.pdf              # Reference PDF for testing (271 KB)
└── README.md                  # Project overview & quick start

## 4. Architecture and Data Flow

Attendly follows a standard modular client-server architecture:

### Components
- **Frontend (React + TypeScript, port 5173):** Single-page app with four routes — `/` (Home upload view), `/setup` (curriculum configuration), `/dashboard` (main metrics), `/subject/:subjectName` (drill-down history). Uses Vite dev proxy to forward `/api/*` to the backend.
- **Backend (FastAPI, port 8000):** REST API with six endpoints:
  - `GET /api/health` — health check
  - `POST /api/attendance/upload` — upload & parse a PDF
  - `POST /api/attendance/fetch` — automate SAP portal login via Playwright, then parse
  - `GET /api/attendance/current` — retrieve the most recent dataset
  - `GET /api/attendance/subjects` — list subject summaries
  - `GET /api/attendance/subjects/{name}` — detail for one subject
  - `DELETE /api/attendance/current` — completely wipes all records and datasets from SQLite (idempotent, returns 200).
- **PDF Parser (`parser.py`):** Uses PyMuPDF to extract text, validates file type (rejects HTML, OOXML, Office binary), extracts student metadata from page 1 header dynamically without assuming specific degrees (supports MBA, B.Tech, MCA, BBA, B.Pharm, Law, etc.), and scans all pages line-by-line for integer serial numbers to identify attendance rows (course, date, start/end time, status).
- **Normalizer (`normalizer.py`):** Strips section codes (T1/P1/U1/L1, etc.) and program/batch suffixes using a generic, degree/semester-agnostic regex pattern `SUFFIX_PATTERN = re.compile(r'(?:\s+)?([TPUL]\d+)(?:[-:\s]+[A-Za-z0-9\.\-\_\s]+)?$', re.IGNORECASE)`. Operates without hardcoded subject lists or static degree strings.
- **Calculator (`calculator.py`):** Groups records by normalized course name; computes present/absent/not_updated counts; percentage = `(present / (present + absent)) * 100` (NU excluded from denominator). Overall attendance is pooled across all subjects, NOT an average of subject percentages.
- **Database (`database.py`):** SQLite with two tables — `datasets` (student metadata + import timestamp) and `attendance_records` (per-session rows with FK to datasets). WAL mode enabled with `PRAGMA busy_timeout=30000` and generous 30s connection timeouts. On re-upload, existing datasets are deleted to prevent stale accumulation; on reset (`delete_current_dataset()`), all records and datasets are wiped.
- **Scraper (`scraper.py`):** Playwright automation targeting `https://sdc-sppap1.svkm.ac.in:50001/irj/portal`. Uses a Pixel 7 mobile emulation to bypass desktop CAPTCHA. Logs in, navigates to "Attendance Display for Students", targets the `isolatedWorkArea` WebDynpro iframe, dynamically selects the latest academic year / semester / "Detail Report" dropdowns, fills date range, clicks SUBMIT (`#WD51`), and extracts the generated PDF bytes from the embedded `<object class="lsPdfObject">`.
- **Dynamic Subject Abbreviations & Complete Reset:**
  - `SUBJECT_ABBREVIATIONS` in `frontend/src/lib/subjectUtils.ts` is empty `{}` by default. Acronyms are generated dynamically by `getBaseDefaultAbbreviation` algorithmically based on word initials, Roman numerals, and LAB/PR suffixes, and can be customized by students in `/setup`.
  - When Reset is triggered on the dashboard, `clearAllAttendlyStorage()` wipes all `attendly_*` keys from `localStorage` (`attendly_curriculum_settings`, `attendly_subject_merge_map`, `attendly_deleted_subjects`, `attendly_nu_policy`, `attendly_nu_overrides`, `attendly_sap_id`, `attendly_sap_pw`), and `deleteCurrentAttendance()` wipes the backend SQLite database, returning the software to a 100% clean, blank state.

### Data Flow
1. **Manual upload:** Student drops a PDF into `UploadZone` → `POST /api/attendance/upload` → FastAPI validates (extension `.pdf`, max 10 MB) → parser extracts metadata + records → normalizer cleans course names → calculator computes summaries → database persists → full dataset returned as JSON → frontend navigates to `/dashboard`.
2. **Portal fetch:** Student enters credentials in `SyncModal` → `POST /api/attendance/fetch` → scraper runs in a dedicated Windows Proactor background thread (isolated from Uvicorn's event loop) → returns PDF bytes → same parsing/saving pipeline as upload.

### Key Mathematical Rules
- **NU exclusion:** `Counted = Present + Absent`; `Percentage = Present / Counted * 100`. If counted is 0, percentage is `null`.
- **Overall attendance:** `ΣPresent / Σ(Present + Absent) * 100` (NOT average of subject percentages).
- **Bunk buffer / recovery (integer math):** When above target, `maxBunks = floor((100*P - R*T) / R)`. When below target, `needed = ceil((R*T - 100*P) / (100 - R))`. Uses integer arithmetic to avoid IEEE-754 float drift.
- **Curriculum model & Credit Harmony:** 15-week fixed semester. `Planned Lectures = Credits * 15`.
  - Pure theory courses: `Planned = TheoryCredits * 15`. Conducted = count of theory records.
  - Pure practical/lab courses: `Planned = LabCredits * 15`. Conducted = count of lab sessions (distinct dates or paired 2-hr slots).
  - Integrated courses (Theory + Lab): `Planned Theory = TheoryWeekly * 15`; `Planned Lab = LabWeekly * 15`; `Total Planned = Credits * 15`.
  - Linked Practical courses: Child records merged under parent are tagged with `linked_from_course: original_name` and `is_lab_session: true`. `countTwoHoursAsOne` is automatically set to `true`, and `theoryWeekly + labWeekly` is enforced to match `totalCredits`. `calculateSubjectLecturesStats` never arbitrarily doubles `plannedLab`.

## 5. Development Setup

### Prerequisites
- **Python:** 3.10+ (verified working: 3.13.7).
- **Node.js:** 18+ with `npm`.
- **Browser:** Desktop-class modern browser for the best visual experience.

### Backend Setup
```bash
cd backend

# 1. Create and activate virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. (Optional) Install Playwright browser for portal sync feature
playwright install chromium

# 4. Start backend server (runs on http://127.0.0.1:8000)
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Frontend runs at http://localhost:5173
# /api/* requests are automatically proxied to http://localhost:8000
```

### One-Click Launcher
Double-click `start_app.bat` in the project root to start both backend & frontend and open the browser automatically. It checks for `backend/.venv\Scripts\python.exe` and uses it if present, otherwise falls back to system Python.

### Environment Variables
- `SAP_USER` — SAP Student ID (used by `run_scraper.py` as default username).
- `SAP_PASS` — SAP Portal Password (used by `run_scraper.py` as default password).
- No other environment variables are required. The application is fully local-first with no external API keys or cloud services.

### Configuration
- **CORS:** `backend/app/main.py` allows origins `http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:3000`.
- **Max upload size:** 10 MB (`MAX_UPLOAD_SIZE` in `main.py`).
- **Allowed extensions:** `.pdf` only.
- **Frontend curriculum settings** (course abbreviations, credits, formats, lab merge maps, NU policy overrides) are stored in `localStorage` under keys: `attendly_curriculum_settings`, `attendly_subject_merge_map`, `attendly_deleted_subjects`, `attendly_nu_policy`, `attendly_nu_overrides`.

## 6. Testing and Build

### Backend Tests
The backend test suite lives in `backend/tests/test_backend.py` (47 tests). Verified passing:
```bash
cd backend
.venv\Scripts\python.exe -m pytest tests/test_backend.py -v
```
Result: **47 passed, 5 warnings** (warnings are benign PyMuPDF SWIG deprecations).
Tests cover: course normalization (16 cases), attendance calculation including NU exclusion and overall-not-average (12 cases), PDF parsing (asserts parsed record structure, semester "III", etc.), and invalid input handling (3 cases).

**NOTE:** Scratch files and credentials have been purged from the repository. The test suite (`tests/test_backend.py`) passes cleanly with zero failures.

### Frontend Type Check & Build
```bash
cd frontend
npx tsc --noEmit          # TypeScript type check — passes with 0 errors
npm run build             # tsc && vite build — verified working
```
Build output goes to `frontend/dist/` (JS: 765 kB, CSS: 57.71 kB). A chunk-size warning is shown but is non-fatal.

### Lint
No dedicated lint configuration (ESLint/Prettier) is present in the frontend. The project relies on TypeScript strict checking via `tsc --noEmit`.

### Production Run Commands
- Backend: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2`
- Frontend: `npm run build` then serve `dist/` via Nginx or a PaaS.

## 7. Coding Conventions

- **Backend (Python):** PEP 8-compliant. Module-level docstrings describe purpose and key rules. Functions use type hints (`list[AttendanceRecord]`, `Optional[...]`). Constants are UPPER_SNAKE_CASE (`MAX_UPLOAD_SIZE`, `VALID_STATUSES`, `MONTH_MAP`). Internal helpers are prefixed with `_`. Errors are raised as `ValueError` with descriptive messages; API endpoints catch exceptions and return structured `UploadResponse(success=False, error=...)` rather than raw HTTP 500s.
- **Frontend (TypeScript):** Strict TypeScript. Types live in `frontend/src/lib/types.ts` and mirror the backend Pydantic models exactly (field names match across the API boundary). Custom hooks and components are function components with `export default function`. Reusable math/logic lives in `lib/subjectUtils.ts` and `lib/analytics.ts`. Icons from `lucide-react`. Styling uses Tailwind v4 utility classes plus custom CSS variables in `index.css` (glass panels, animations).
- **Naming:** Backend uses `snake_case` for files and functions; frontend uses `PascalCase.tsx` for components and `camelCase.ts` for utilities. Course names are normalized to UPPERCASE canonical forms.
- **Error handling:** Frontend `api.ts` wraps fetches in `handleResponse<T>` which throws `ApiError` with status and backend message; components catch and display.
- **State management:** React `useState`/`useMemo`/`useEffect`. No Redux or state library. Curriculum settings persist in `localStorage`.

## 8. Technical Decisions

| Decision | Reason | Alternatives considered | Consequences |
| :--- | :--- | :--- | :--- |
| **NU excluded from denominator** | NMIMS SAP marks un-finalized classes as NU; counting them would distort true attendance. | Include NU as absent (penalizes student when teachers haven't updated). | Percentage reflects only finalized sessions; `null` when all sessions are NU. |
| **Overall = pooled present/total, not average of subjects** | Averaging subject percentages overweights low-count courses. | Simple arithmetic mean of subject percentages. | Fairer university-wide metric. |
| **Integer arithmetic for bunk buffer** | Floating-point drift (e.g., `6.000000000000015`) can flip `Math.ceil` results. | Float-based `(0.80*total - present)/0.20`. | Guaranteed correct integer ceiling/floor results. |
| **Pixel 7 mobile emulation for portal sync** | Desktop CAPTCHA requirements on the SAP portal; mobile viewport bypasses them. | Headless desktop Chromium (would hit CAPTCHA). | Visible 430x920 window appears on screen; sync works reliably. |
| **Scraper runs in a Windows Proactor background thread** | Isolates Playwright's event loop from Uvicorn's main async loop (prevents subprocess errors on Windows). | Direct `asyncio.run` in the request coroutine. | FastAPI stays responsive; headed Chromium displays correctly. |
| **SQLite with WAL mode** | Single-user local app; no server setup needed. | PostgreSQL / client-server DB. | Zero-config persistence; `attendly.db` file is auto-created. |
| **Curriculum config in localStorage** | Per-machine, per-student settings that don't need backend sync. | Backend-persisted curriculum table. | Simpler schema; settings are browser-specific. |
| **Vite dev proxy for `/api/*`** | Avoids CORS configuration on the backend during development. | Separate dev CORS rules or backend serving frontend. | Single-line config in `vite.config.ts`; no backend changes needed. |
| **In-Browser Client-Side PDF Parsing (pdfjs-dist)** | Allows 100% free hosting (Vercel/Cloudflare Pages/Netlify) without requiring a server/backend for constant processing. | Server-only PyMuPDF parsing requiring always-on backend. | App operates completely offline/serverless; parses and calculates attendance directly in the user's browser. |
| **Dual-Mode Data Layer (localStorage + Backend)** | Seamless local persistence for serverless hosting while preserving backend sync when run locally. | Backend-only SQLite or client-only memory. | User data persists across browser sessions without any backend server. Full wipe via complete reset. |
| **PWA & Responsive Android Support** | Optimal mobile experience for students checking attendance on their phones. | Desktop-only layout. | Works on PC and Android with 'Add to Home screen' standalone app capability. |

## 9. Known Issues and Limitations

- **Cleaned Codebase:** Obsolete scratch scripts (`test_scraper_unit.py`, `test_dropdown_selection.py`) and ghost components (`SubjectGrid.tsx`, `SubjectCard.tsx`, `AttendanceCriterionTracker.tsx`) were removed. Real test suite is cleanly isolated in `backend/tests/`.
- **Parser format dependency:** The parser strictly expects the SVKM/NMIMS SAP standard attendance format. Major format changes by the university will require parser updates.
- **Exemptions (E) and Late Admissions (L) are parsed but ignored** in standard P/A/NU percentage math (they are not counted in present, absent, or counted).
- **No ESLint/Prettier:** Frontend relies solely on `tsc --noEmit` for correctness; no formatter is configured.
- **Chunk size warning:** Production build emits a non-fatal warning about chunks >500 kB after minification.
- **Portal sync requires internet/university network** and a working SAP portal session; CAPTCHA may appear on non-mobile viewports.
- **Single-user only:** SQLite backend has no authentication or multi-user support.

## 10. Current Development State

- **Last verified working state:** Numerical accuracy and credit harmony fixes completed. Linked subject tracking fully implemented across dashboard and subject detail views. Backend tests pass (47/47). Frontend builds cleanly (0 TypeScript errors).
- **Current task:** Fixed inaccurate numbers on dashboard, aligned lecture counts strictly to credits (Credits * 15), added linked practical subject tracking, badges, and component filters in Subject Detail.
- **Pending work:**
  - Delete the two scratch credential files in `backend/` and the three ghost components in `frontend/src/components/` (see `documentation/05_CODEBASE_CLEANUP_AND_UNWANTED_FILES.md`).
  - Implement Phase 2 features: bunk calculator UI, recovery calculator, visual timetable/calendar, forecasting (see `README.md` "Future Phase 2 Features").
  - Complete the dynamic multi-semester setup engine described in `documentation/06_ACTION_PLAN_DYNAMIC_SETUP.md`.
- **Last knowledge update:** 2026-10-16 (verified against actual codebase, tests, and browser visual inspection).

## 11. Notes for the Next AI Agent

- **Read first:** Always read this file plus `AGENTS.md`, `docs/CHANGELOG.md`, and `README.md` before starting work. The detailed per-module breakdowns in `documentation/00..06` are the deepest source of truth.
- **Never run `pytest` from the `backend/` root without first deleting** `backend/test_scraper_unit.py` and `backend/test_dropdown_selection.py` — they contain hardcoded SAP credentials and will break test collection. The real suite is `backend/tests/test_backend.py`.
- **Never commit or push** the scratch credential files or any new file containing student credentials.
- **Backend commands** run from `backend/` with the venv active: `python -m pytest tests/test_backend.py -v` (47/47 pass), `uvicorn app.main:app --reload`.
- **Frontend commands** run from `frontend/`: `npm run build` (verified, 0 TS errors), `npm run dev`.
- **Do not break the API contract:** TypeScript types in `frontend/src/lib/types.ts` must stay in sync with Pydantic models in `backend/app/models.py`. Field names match exactly across the boundary.
- **NU handling is the core domain rule:** Any change to attendance math must preserve NU exclusion from the denominator and the pooled (not averaged) overall percentage.
- **The `/setup` route and localStorage curriculum settings** are the foundation for the upcoming dynamic multi-semester engine — changes there affect `Dashboard.tsx`, `SubjectDetail.tsx`, and `IntegratedCoursePanel.tsx`.
- **The scraper is fragile by nature:** It depends on specific SAP WebDynpro DOM IDs (`#WD2B`, `#WD33`, `#WD39`, `#WD46`, `#WD4B`, `#WD51`, `isolatedWorkArea`). If the portal UI changes, update `backend/app/scraper.py` and `backend/run_scraper.py`.
- **If you cannot verify something, label it as unknown** rather than guessing. The project values accuracy over completeness.