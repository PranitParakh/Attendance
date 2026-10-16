# Attendly — Documentation Index

Welcome to the comprehensive documentation suite for **Attendly**. This directory contains exhaustive, line-by-line documentation covering every module, architectural concept, and component in the codebase.

Whether you are a student exploring how Attendly works, a developer maintaining the code, or an AI agent continuing future work, these guides provide complete transparency into every part of the application.

---

## 📚 Documentation Directory

| Document | Description |
| :--- | :--- |
| [**00. System Architecture & Core Concepts**](./00_SYSTEM_ARCHITECTURE_AND_CORE_CONCEPTS.md) | High-level system architecture, client-server data flow, mathematical formulas (bunk buffer integer math, NU handling, overall attendance pooling), and SQLite persistence schema. |
| [**01. Backend Files Deep Dive**](./01_BACKEND_FILES_DEEP_DIVE.md) | Line-by-line and section-by-section breakdown of all backend files: `main.py`, `models.py`, `database.py`, `calculator.py`, `normalizer.py`, `parser.py`, `scraper.py`, and test suites. |
| [**02. Frontend Core & Libraries**](./02_FRONTEND_CORE_AND_LIBRARIES.md) | Complete breakdown of frontend infrastructure: entry point (`main.tsx`), router (`App.tsx`), Tailwind v4 styles, TypeScript schemas (`types.ts`), API layer (`api.ts`), and math engines (`subjectUtils.ts`, `analytics.ts`). |
| [**03. Frontend Pages & Components**](./03_FRONTEND_PAGES_AND_COMPONENTS.md) | Deep dive into user interface pages (`Home`, `Dashboard`, `SubjectDetail`) and all React components (`IntegratedCoursePanel`, `OverallAttendanceCard`, `NuPolicySelector`, `SyncModal`, etc.). |
| [**04. Scripts & Operations**](./04_SCRIPTS_AND_OPERATIONS.md) | Operational guide for Windows batch scripts (`start_app.bat`, `start_backend.bat`, `sync_portal.bat`), CLI scraper tools, and production deployment instructions. |
| [**05. Codebase Cleanup & Unwanted Files**](./05_CODEBASE_CLEANUP_AND_UNWANTED_FILES.md) | Complete audit of dead ghost components, temporary scratch files, and security risks (hardcoded credentials in scratch tests) with verification and deletion instructions. |
| [**06. Dynamic Setup Action Plan**](./06_ACTION_PLAN_DYNAMIC_SETUP.md) | Comprehensive engineering plan to make Attendly dynamic, multi-semester capable, and configurable via a student setup page (`/setup`). |

---

## ⚡ Quick Reference: How to Run

1. **One-Click Run**: Double-click [start_app.bat](../start_app.bat) in the project root to spin up both Backend and Frontend and open your browser automatically.
2. **Backend Tests**: Run `.venv\Scripts\pytest tests/test_backend.py` from `backend/` (47/47 tests pass).
3. **Frontend Build**: Run `npm run build` from `frontend/` (TypeScript compiles cleanly with 0 errors).
