@echo off
title Attendly - Launcher
echo ========================================================
echo               STARTING ATTENDLY APP
echo ========================================================
echo.
echo Launching Backend (FastAPI on http://127.0.0.1:8000)...
echo Launching Frontend (Vite React on http://localhost:5173)...
echo.

set ROOT_DIR=%~dp0

:: 1. Start Backend in a dedicated window
if exist "%ROOT_DIR%backend\.venv\Scripts\python.exe" (
    start "Attendly Backend" cmd /k "cd /d "%ROOT_DIR%backend" && "%ROOT_DIR%backend\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
) else (
    start "Attendly Backend" cmd /k "cd /d "%ROOT_DIR%backend" && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
)

:: 2. Start Frontend in a dedicated window
start "Attendly Frontend" cmd /k "cd /d "%ROOT_DIR%frontend" && npm run dev"

:: 3. Wait briefly for servers to spin up, then open browser
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo.
echo ========================================================
echo  Both services are running in separate terminal windows!
echo  - Backend:  http://127.0.0.1:8000
echo  - Frontend: http://localhost:5173
echo.
echo  Close the respective terminal windows to stop them.
echo ========================================================
echo.
pause
