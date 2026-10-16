@echo off
title Attendly - Live SAP Portal Sync (Pixel 7 View)
echo ========================================================
echo   ATTENDLY SAP PORTAL LIVE SYNC (Pixel 7 View)
echo ========================================================
echo.
echo This will open a visible Pixel 7 phone-sized window
echo on your screen and fetch your latest attendance PDF.
echo.

cd /d "%~dp0backend"
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" run_scraper.py attendance_report.pdf --parse
) else (
    python run_scraper.py attendance_report.pdf --parse
)

echo.
echo Sync completed.
pause
