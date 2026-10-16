# Scripts & Operations Deep Dive

This document details the batch scripts, automation utilities, and deployment procedures provided in the repository.

---

## 1. Windows Batch Scripts

### 1.1 `start_app.bat` (Recommended All-in-One Launcher)
**Location**: Project root (`d:\NOTES\Antigravity Notes\AttendanceCALCULATOR\start_app.bat`)

**Purpose**: Starts both the FastAPI backend and the React Vite frontend simultaneously with a single double-click, then automatically launches the user's browser.

**Line-by-Line Breakdown**:
```bat
1: @echo off
2: title Attendly - Launcher
```
- Silences command echoing and sets the terminal title.

```bat
11: set ROOT_DIR=%~dp0
```
- Sets `ROOT_DIR` to the exact folder containing the `.bat` file (ensures paths work regardless of where the script was launched from).

```bat
14: if exist "%ROOT_DIR%backend\.venv\Scripts\python.exe" (
15:     start "Attendly Backend" cmd /k "cd /d "%ROOT_DIR%backend" && "%ROOT_DIR%backend\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
16: ) else (
17:     start "Attendly Backend" cmd /k "cd /d "%ROOT_DIR%backend" && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
18: )
```
- Checks if the Python virtual environment (`backend/.venv`) exists.
- Launches Uvicorn running `app.main:app` on `127.0.0.1:8000` with hot-reload in a new titled Command Prompt window.

```bat
21: start "Attendly Frontend" cmd /k "cd /d "%ROOT_DIR%frontend" && npm run dev"
```
- Launches the Vite dev server (`npm run dev`) on `localhost:5173` in a second titled Command Prompt window.

```bat
24: timeout /t 3 /nobreak >nul
25: start http://localhost:5173
```
- Pauses for 3 seconds to let backend and frontend initialize, then opens `http://localhost:5173` in the default browser.

---

### 1.2 `start_backend.bat`
**Location**: Project root (`start_backend.bat`)

**Purpose**: Runs only the backend in interactive desktop mode.
- Ideal when developing backend features or running tests without touching the frontend.
- Uses `cmd /k` to stay open and show logs. When portal sync is triggered, the headed Chromium automation window displays cleanly.

---

### 1.3 `sync_portal.bat`
**Location**: Project root (`sync_portal.bat`)

**Purpose**: Standalone CLI runner that launches the Playwright portal scraper from the command line without opening a web browser.
- Executes `python run_scraper.py attendance_report.pdf --parse`.
- Prompts for SAP Student ID and Password, downloads `attendance_report.pdf`, and displays a parsed summary in the terminal.

---

## 2. CLI Automation Runner (`backend/run_scraper.py`)

**Location**: `backend/run_scraper.py`

**Purpose**: Command-line interface for the SAP portal scraper. Can be run manually or integrated into scheduled cron jobs.

### Arguments:
```bash
python run_scraper.py <output_pdf_file> [username] [password] [--parse] [--headless]
```
- `output_pdf_file`: Destination file path for downloaded PDF (e.g. `attendance_report.pdf`).
- `username`: Student SAP ID (optional, checks `SAP_USER` env var or prompts).
- `password`: Portal password (optional, checks `SAP_PASS` env var or prompts via `getpass`).
- `--parse`: Parses the downloaded report and prints a formatted text summary of attendance.
- `--headless`: Runs Chromium in the background without showing the desktop window.

---

## 3. Deployment Summary

### Local Development
1. Start backend: `cd backend && .venv\Scripts\activate && uvicorn app.main:app --reload`
2. Start frontend: `cd frontend && npm run dev`
3. Access UI: `http://localhost:5173`
4. Access API Docs (Swagger): `http://127.0.0.1:8000/docs`

### Production VPS Deployment
1. Build frontend: `cd frontend && npm run build` (outputs to `frontend/dist/`).
2. Run backend via systemd/supervisor: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2`.
3. Configure Nginx reverse proxy to serve `frontend/dist/` on root (`/`) and proxy `/api/` to `http://127.0.0.1:8000`.
