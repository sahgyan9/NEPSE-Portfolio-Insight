@echo off
setlocal
title Stop Portfolio Nepse Services

echo Stopping Portfolio Nepse background services...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop.ps1"
echo.
echo Press any key to close this window...
pause >nul
endlocal
