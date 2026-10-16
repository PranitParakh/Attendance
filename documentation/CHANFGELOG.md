# Project Changelog

This file records meaningful project changes in reverse chronological order (newest first).

---

## 2026-10-16 — Pure Client-Side Serverless Architecture & 100% Free Hosting for PC & Android

### Added
- **In-Browser Client-Side PDF Parser (`frontend/src/lib/clientParser.ts`):**
  - Integrated `pdfjs-dist` to extract text items and lines directly in the user's browser without requiring any backend server.
  - Ports student metadata extraction (Student Name, Number, Roll No, Academic Year, Semester, Program, Dates) and attendance record tokenization into pure TypeScript.
  - Implements browser-based dynamic course normalization with degree-agnostic slot regex.
  - Calculates subject summaries (present, absent, NU, percentage) and overall pooled attendance directly in the client.
- **Client-First Dual-Mode Persistence (`frontend/src/lib/api.ts`):**
  - Updated `uploadAttendancePDF` to parse PDFs in the browser and persist datasets to `localStorage` under `attendly_saved_dataset`.
  - Added background opportunistic sync to backend when available, while functioning 100% autonomously when hosted statically.
  - Updated `getCurrentAttendance`, `getSubjectDetail`, and `deleteCurrentAttendance` to operate seamlessly offline and in serverless environments.
  - Added `'attendly_saved_dataset'` to `ATTENDLY_STORAGE_KEYS` in `subjectUtils.ts` so Complete Reset wipes all local datasets.
- **100% Free Static Hosting Configurations:**
  - Added `frontend/vercel.json` and root `vercel.json` with SPA route rewrites (`/* -> /index.html`).
  - Added `frontend/public/_redirects` with `/* /index.html 200` for Cloudflare Pages and Netlify deployments.
  - Fully compatible with free tiers of Vercel, Cloudflare Pages, Netlify, and GitHub Pages with zero running costs and zero server maintenance.
- **Android Mobile & PWA Optimization:**
  - Added web app manifest `frontend/public/manifest.json` enabling "Add to Home Screen" standalone app mode on Android and iOS devices.
  - Enhanced `frontend/index.html` with mobile meta tags (`theme-color`, `mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`).
  - Optimized touch targets, action button flex wrapping, and responsive overflow-x handling on mobile screens.

### Verification
- **Frontend Type Check:** `npx tsc --noEmit` $\rightarrow$ **0 errors**.
- **Frontend Production Build:** `npm run build` $\rightarrow$ Successfully bundled production assets including `pdf.worker.min` in 608ms.
- **Backend Test Suite:** `py -m pytest tests/` $\rightarrow$ **51 passed** in 0.99s.
- **Zero-Backend Mobile E2E Test:** Terminated backend server (PID 13868) and executed complete PDF upload, parsing, curriculum setup, dashboard rendering, and complete reset at 390x844 mobile viewport using `browser_subagent`. Verified flawless execution with zero backend dependency.

---

## 2026-10-16 — Complete Software Reset & Dynamic Degree/Branch-Agnostic Subject Architecture

### Added
- **Complete Software Reset Modal (`Dashboard.tsx`):**
  - Integrated a sleek glassmorphism reset confirmation modal detailing all layers of data to be purged (database records, curriculum settings, linked mappings, and NU overrides).
  - Eliminates browser native `confirm()` dialogs and prevents popup blocker stalls.
- **Full Storage Purge Utility (`clearAllAttendlyStorage()` in `frontend/src/lib/subjectUtils.ts`):**
  - Iterates and removes all `localStorage` keys matching `attendly*` (`attendly_curriculum_settings`, `attendly_subject_merge_map`, `attendly_deleted_subjects`, `attendly_nu_policy`, `attendly_nu_overrides`, `attendly_sap_id`, `attendly_sap_pw`).
- **Dynamic Acronym Engine (`getBaseDefaultAbbreviation()` in `frontend/src/lib/subjectUtils.ts`):**
  - Algorithmically creates clean acronyms for any course name across any engineering/university stream (e.g., `BUILDING DESIGN AND DRAWING` $\rightarrow$ `BDD`, `DATA STRUCTURES & ALGORITHMS` $\rightarrow$ `DSA`, `FLUID MECHANICS` $\rightarrow$ `FM`, `CONSTITUTION OF INDIA` $\rightarrow$ `CI`).
  - Supports single-word courses $\le 10$ characters (e.g., `PYTHON`, `PHYSICS`), Roman numerals (e.g., `M-3`), and `LAB`/`PR` suffixes.
- **Cross-Discipline Normalizer Tests (`backend/tests/test_backend.py`):**
  - Added test cases verifying normalization for Civil Engineering, Mechanical Engineering, Law, and Pharmacy.

### Changed
- **Wipe All Records on Reset (`backend/app/database.py` & `backend/app/main.py`):**
  - `delete_current_dataset()` now executes `DELETE FROM attendance_records; DELETE FROM datasets;` with busy timeout protection (`PRAGMA busy_timeout=30000; timeout=30.0`), guaranteeing a 100% clean SQLite database upon reset.
  - `DELETE /api/attendance/current` endpoint is idempotent and returns `200 OK` with success message even when the database was already empty (preventing 404 alert dialogs in the frontend).
- **Universal Program/Degree Name Parser (`backend/app/parser.py`):**
  - Removed hardcoded `"MBA" in candidate.upper()` constraint when extracting `Program Name` from page headers. Any academic program (e.g., B.Tech, MCA, BBA, B.Pharm, Law, MBA Tech) is now extracted dynamically.
- **Universal Course Suffix Pattern (`backend/app/normalizer.py`):**
  - Generalized `SUFFIX_PATTERN` to `r'(?:\s+)?([TPUL]\d+)(?:[-:\s]+[A-Za-z0-9\.\-\_\s]+)?$'` to match any slot/section code and degree suffix dynamically without hardcoded program acronym lists.
  - Emptied `ABBREVIATION_MAP = {}` in `normalizer.py` and `SUBJECT_ABBREVIATIONS = {}` in `subjectUtils.ts` so the system relies entirely on dynamic algorithmic extraction and student user settings.

### Verification
- **Backend Test Suite:** `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_backend.py -v` $\rightarrow$ **51 passed, 5 warnings** in 1.80s.
- **Frontend Type Check:** `npx tsc --noEmit` $\rightarrow$ **0 errors**.
- **Database Reset Verified:** Checked SQLite via python: `datasets = 0`, `attendance_records = 0`.
- **API Endpoint Verified:** `DELETE /api/attendance/current` $\rightarrow$ `200 {"success": true, "message": "All attendance data and records deleted"}`. Subsequent calls return `200` idempotently.
- **Browser Visual Verification:** Browser subagent verified the Complete Software Reset modal, confirmed reset flow, and verified `localStorage` has 0 `attendly_` keys.

---

## 2026-10-16 — Dashboard Numerical Accuracy, Credit Harmony & Linked Subject Tracking

### Fixed
- **Curriculum Credit-to-Planned-Lecture Formula Violation (`Credits * 15 Weeks`):**
  - Previously, `calculateSubjectLecturesStats` in `frontend/src/lib/subjectUtils.ts` artificially doubled `plannedLab` (`plannedLab = plannedLab * 2`) whenever `countTwoHoursAsOne` was false or omitted, causing pure lab and integrated courses to show distorted planned lectures (e.g., 30 planned lectures instead of 15 for a 1-credit lab; 60 planned lectures instead of 45 for a 3-credit course).
  - Removed arbitrary `plannedLab` doubling across both pure lab and integrated branches. `totalPlanned` now strictly and reliably equals `totalCredits * 15` weeks (or `(theoryWeekly + labWeekly) * 15`).
- **Remaining Lecture Count Doubling on Pure Lab Courses:**
  - `calculateSubjectLecturesStats` previously conflated total completed/planned with theory completed/planned on single-format lab courses, causing `totalRemaining` to sum `remainingTheory + remainingLab` and double the remaining count (e.g., 11 of 15 conducted displayed as "8 left" instead of 4 left). Single-format lab, pure theory, and integrated stats are now strictly isolated.
- **Linked Subjects Missing from Subject Detail History:**
  - `applySubjectMergeMap` now tags child records with `linked_from_course: r.course_normalized`.
  - `SubjectDetail.tsx` now displays a dedicated **Linked Practical Course** banner with full child course names, record counts, and a direct configure button.
  - Added **Component Filter tabs** (`All Records`, `Theory Only`, `Practical / Lab Only`) in `SubjectDetail.tsx` to allow students to inspect sessions by origin component.
  - History table rows now explicitly display a `🔗 Linked: [Child Abbreviation]` badge with tooltip showing the full original child course name.
  - History section header displays exact session breakdown (e.g., `Showing 40 of 40 records (16 Theory + 24 Practical from BUILDING DESIGN AND DRAWIP1-BT CIV-BT 1)`).
- **Linked Course Badges & Info on Dashboard Cards:**
  - `IntegratedCoursePanel.tsx` now detects linked child subjects from `getStoredMergeMap()`, displaying a `🔗 + Practical Linked` badge in the header and an informative `🔗 Linked: [Child Subject Name]` tag underneath the course title.
  - Dashboard session projection box accurately reports conduct/plan numbers (e.g., `Theory: 16/30 • Lab: 11/15` and `18 left`).
- **Automatic 2-Hour Lab Pairing for Linked Practical Subjects:**
  - `getStoredSubjectConfig()` now automatically sets `countTwoHoursAsOne: true` and balances `theoryWeekly + labTutorialWeekly = totalCredits` whenever a course has linked children, preventing stale `countTwoHoursAsOne: false` configurations from desynchronizing planned lectures from credits.

### Verification
- **Backend Test Suite:** `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_backend.py -v` → **47 passed, 5 warnings** in 1.53s.
- **Frontend Type Check:** `npx tsc --noEmit` → **0 errors**.
- **Browser Visual Verification:** Browser subagent navigated to `http://localhost:5173/dashboard` and `http://localhost:5173/subject/BUILDING%20DESIGN%20AND%20DRAWINGT1-BT%20CIV`:
  - Verified dashboard cards: 1-credit practical courses show `of 15 conducted`, 3-credit theory courses show `of 45 conducted`.
  - Verified linked course card: `BUILDING DESIGN AND DRAWINGT1-BT CIV` displays `🔗 + Practical Linked`, `🔗 Linked: BUILDING DESIGN AND DRAWIP1-BT CIV-BT 1`, `Theory: 16/30 • Lab: 11/15`, and `18 left` (27 of 45 conducted).
  - Verified subject detail page: displays top banner, projection cards (Theory 16/30, Lab 11/15, Total 18 left), component tabs (`All (40)`, `Theory (16)`, `Practical (24)`), and `🔗 Linked: BDDBCB1` table badges.

---

## 2026-10-14 — Baseline Established

### Added
- **Attendly Phase 1 — complete local attendance analytics app:**
  - FastAPI backend (`backend/app/main.py`) with REST endpoints for PDF upload, portal fetch, current dataset retrieval, subject listing, subject detail, and dataset deletion.
  - PDF parser (`backend/app/parser.py`) using PyMuPDF to extract student metadata and attendance records from SVKM/NMIMS SAP reports.
  - Course normalizer (`backend/app/normalizer.py`) stripping section codes (T1/P1/U1/L1) and program suffixes, expanding known abbreviations.
  - Attendance calculator (`backend/app/calculator.py`) with NU exclusion from the denominator and pooled (not averaged) overall percentage.
  - SQLite persistence layer (`backend/app/database.py`) with WAL mode, `datasets` + `attendance_records` tables, and cascade deletes.
  - Playwright portal scraper (`backend/app/scraper.py`) using Pixel 7 mobile emulation to log into the SAP portal, navigate the WebDynpro iframe, and extract the generated PDF.
  - CLI scraper runner (`backend/run_scraper.py`) supporting `SAP_USER` / `SAP_PASS` env vars and `--parse` / `--headless` flags.
  - React + TypeScript + Tailwind v4 frontend with four routes: `/` (Home), `/setup` (curriculum configuration), `/dashboard`, `/subject/:name`.
  - NU simulation engine (`frontend/src/lib/subjectUtils.ts`) supporting ignored / all-present / all-absent / individual policies.
  - Bunk buffer and attendance recovery calculator using integer arithmetic to avoid float drift.
  - Curriculum configuration UI (`/setup`) with course abbreviation, credits, format toggle, weekly session distribution, 2-hour lab counting, and subject merge/exclude.
  - Visual analytics (`frontend/src/lib/analytics.ts`) for day-of-week and monthly attendance trends via Recharts.
  - Windows batch launchers: `start_app.bat` (all-in-one), `start_backend.bat`, `sync_portal.bat`.
  - Backend test suite (`backend/tests/test_backend.py`) — 47 tests covering normalization, calculation, PDF parsing, and invalid input.
  - Comprehensive documentation suite in `documentation/` (00–06 deep dives, deployment guide, README).

### Changed
- None prior to baseline.

### Fixed
- None prior to baseline.

### Verification
- Backend: `pytest tests/test_backend.py -v` → **47 passed, 5 warnings** (benign PyMuPDF SWIG deprecations).
- Frontend: `tsc --noEmit` → **0 errors**; `npm run build` → **successful** (JS 765 kB, CSS 57.71 kB).
- Both servers start via `start_app.bat` and serve the app at `http://localhost:5173`.

---

## Unreleased

### Fixed
- **Bug 1 — Database accumulates datasets across re-uploads:** `save_dataset()` previously only marked old datasets `is_current = 0` but never deleted them, causing each upload to append a new dataset + records. Now wipes all existing datasets (via CASCADE) before inserting the fresh one. New `delete_all_datasets()` helper added. Verified: after re-upload, only 1 dataset exists in DB.
- **Bug 2 — Dashboard lecture stats miscounted lab records:** `calculateSubjectLecturesStats()` in `frontend/src/lib/subjectUtils.ts` had flawed logic in the single-format branch that collapsed ALL records by date (not just lab records) when `countTwoHoursAsOne` was true. Fixed to only collapse lab records, and made unit semantics explicit: theory is always in record units; lab is in session units when `countTwoHoursAsOne` is true, record units otherwise.
- **Bug 3 — "Count 2 hours as 1" did not update remaining lecture count:** `rawTotalRemaining` previously used `remainingLab * 2` unconditionally, double-counting when `countTwoHoursAsOne` was false. Now `rawTotalRemaining` correctly converts remaining lab sessions to record units only when `countTwoHoursAsOne` is true, so the bunk calculator sees the right denominator.
- **Bug 4 — Theory+LAB courses showed only a single remaining counter:** `SubjectDetail.tsx` now renders separate "Theory Sessions" and "Lab Sessions" cards with individual remaining counts when `config.hasLabOrTutorial` is true, plus a combined "Total Remaining" card.

### Changed
- `backend/app/database.py`: `save_dataset()` now deletes all existing datasets before insert (was: mark old as not-current).
- `frontend/src/lib/subjectUtils.ts`: `calculateSubjectLecturesStats()` rewritten with explicit unit semantics for theory/lab counts.
- `frontend/src/lib/subjectUtils.ts`: Added `recalculateOverallSummary()` to recompute the top-level card from the merged subject list.
- `frontend/src/lib/subjectUtils.ts`: Added `getStoredNuPolicy()` and `getStoredIndividualOverrides()` helpers.
- `frontend/src/pages/Dashboard.tsx`: `mergedSimulatedData` now recomputes `overall` via `recalculateOverallSummary()` so the top card always matches the per-subject cards below it.
- `frontend/src/pages/SubjectDetail.tsx`: Now applies the same NU simulation pipeline (`simulateAttendanceWithNuPolicy` + `applySubjectMergeMap`) as the dashboard, so subject detail pages show identical counts.

### Verification
- Backend: `pytest tests/test_backend.py` → **47 passed, 5 warnings** (benign PyMuPDF SWIG deprecations).
- Frontend: `tsc --noEmit` → **0 errors**; `npm run build` → **successful** (2484 modules, JS 765.59 kB, CSS 57.71 kB).
- Database reset verified empirically: after re-upload, only 1 dataset row exists.
- Calculator accuracy verified: subject sums match overall totals (186 P, 25 A, 4 NU, 215 total).
- Dashboard consistency: top card and per-subject cards now derive from the same merged subject list.

---

## Format for Future Entries

Each change should be recorded under a date heading (`YYYY-MM-DD`) or `Unreleased` if the date is unknown. Use these subsections, omitting any that have no entries:

```markdown
### Added
- New features, files, or capabilities.

### Changed
- Modifications to existing behavior, APIs, or dependencies.

### Fixed
- Bug fixes or corrections of previous behavior.

### Removed
- Deleted features, files, or dependencies.

### Verification
- Commands run and their results (e.g., "47/47 tests pass", "build succeeds with 0 errors").
```

**Rules:**
- Keep entries factual and concise. Record *why* a non-obvious change was made, not just *which* files changed.
- Never include secrets, credentials, API keys, or tokens.
- Never claim a test, build, or feature works unless you actually ran and verified it.
- If a date is unknown, use `Unreleased` rather than inventing one.
- Add a new date heading for each meaningful change; do not rewrite history.