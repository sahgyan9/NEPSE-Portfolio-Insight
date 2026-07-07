# Portfolio Insight - Start All Services
# This script starts all required servers for the application

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Portfolio Insight - Starting...     " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Start Portfolio Database Server (port 5001)
Write-Host "[1/3] Starting Portfolio Database Server..." -ForegroundColor Yellow
Start-Process -FilePath "$scriptDir\.venv\Scripts\python.exe" -ArgumentList "portfolio_db.py" -WindowStyle Minimized

# Start NEPSE Data Server (port 8000)
Write-Host "[2/3] Starting NEPSE Data Server..." -ForegroundColor Yellow
Start-Process -FilePath "$scriptDir\.venv\Scripts\python.exe" -ArgumentList "nepse_server.py" -WindowStyle Minimized

# Wait a moment for servers to initialize
Start-Sleep -Seconds 2

# Start Vite Dev Server
Write-Host "[3/3] Starting Vite Dev Server..." -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   All services started!               " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Services running:" -ForegroundColor White
Write-Host "  - Frontend:      http://localhost:5173" -ForegroundColor Gray
Write-Host "  - Portfolio DB:  http://localhost:5001" -ForegroundColor Gray
Write-Host "  - NEPSE Server:  http://localhost:8000" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop the frontend server." -ForegroundColor Yellow
Write-Host "(Python servers will continue running in background)" -ForegroundColor Yellow
Write-Host ""

# Open browser once Vite is ready (background job)
Start-Job -ScriptBlock {
    $maxWait = 45
    $waited  = 0
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 2
        $waited += 2
        try {
            $r = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
            if ($r.StatusCode -ge 100) {
                Start-Process "http://localhost:5173"
                break
            }
        } catch { }
    }
} | Out-Null

# Run npm dev in the foreground
npm run dev
