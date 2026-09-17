@echo off
setlocal
title Uninstall Portfolio Nepse

echo ==========================================================
echo               Uninstall Portfolio Nepse
echo ==========================================================
echo.

set "SCRIPT=%~dp0scripts\uninstall.ps1"
if not exist "%SCRIPT%" (
    echo Error: uninstall.ps1 not found in %~dp0scripts.
    pause
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
endlocal
