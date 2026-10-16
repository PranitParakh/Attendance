@echo off
title Attendly - Local Backend Server
echo ========================================================
echo   ATTENDLY BACKEND SERVER (Interactive Desktop Mode)
echo ========================================================
echo.
echo Starting backend on http://127.0.0.1:8000 ...
echo When you sync from your browser, the live Pixel 7
echo automation window will appear right on your screen.
echo.
echo Press Ctrl+C in this window anytime to stop the server.
echo ========================================================
echo.

cd /d "%~dp0backend"
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
) else (
    python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
)

pause
