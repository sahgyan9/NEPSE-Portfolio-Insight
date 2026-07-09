@echo off
REM Portfolio Insight - Start All Services (Double-click to run)
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "start.ps1"
echo.
echo ========================================
echo Press any key to close this window...
echo ========================================
pause > nul
