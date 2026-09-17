@echo off
setlocal
title Portfolio Nepse Setup

echo ==========================================================
echo                 Portfolio Nepse Setup
echo    Intelligent Portfolio Tracker & Investment Analysis
echo ==========================================================
echo.

set "SCRIPT=%~dp0scripts\setup-windows.ps1"
if not exist "%SCRIPT%" (
    echo Error: setup-windows.ps1 not found in %~dp0scripts.
    pause
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
set "RC=%ERRORLEVEL%"

echo.
if "%RC%"=="0" (
    echo Setup completed successfully.
    echo Press the Windows key and search: portfolio nepse
) else (
    echo Setup encountered an error ^(Code: %RC%^).
)

echo.
echo Press any key to close this window...
pause >nul
endlocal
