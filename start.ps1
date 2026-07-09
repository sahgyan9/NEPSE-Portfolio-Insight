# Portfolio Insight - Start Services
# This script starts the database and main scraper APIs

Write-Host ""
Write-Host "Starting Portfolio Insight services..." -ForegroundColor Green

# Resolve script directory robustly (works when called from .bat, double-click, or PS directly)
if ($PSScriptRoot -and (Test-Path $PSScriptRoot)) {
    $scriptDir = $PSScriptRoot
} elseif ($MyInvocation.MyCommand.Path) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
} else {
    $scriptDir = (Get-Location).Path
}
Write-Host "Script directory: $scriptDir" -ForegroundColor DarkGray

# 1. Verify virtual environment exists
$venvDir = "$scriptDir\.venv"
if (-not (Test-Path $venvDir)) {
    Write-Host "ERROR: Virtual environment (.venv) not found at root!" -ForegroundColor Red
    Write-Host "Please create the virtual environment and install dependencies before running." -ForegroundColor Yellow
    exit 1
}

# 2. Precheck port availability
$port5001 = Get-NetTCPConnection -LocalPort 5001 -ErrorAction SilentlyContinue
$port8000 = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue

if ($port5001) {
    Write-Host "WARNING: Port 5001 is already in use by another process. Database server may already be running." -ForegroundColor Yellow
}
if ($port8000) {
    Write-Host "WARNING: Port 8000 is already in use by another process. NEPSE server may already be running." -ForegroundColor Yellow
}

# 3. Launch portfolio database server (port 5001)
$dbProcess = $null
if (-not $port5001) {
    Write-Host "Launching local database API (port 5001)..." -ForegroundColor Cyan
    $dbProcess = Start-Process -FilePath "$venvDir\Scripts\python.exe" -ArgumentList "$scriptDir\portfolio_db.py" -NoNewWindow -PassThru
}

# 4. Launch NEPSE data server (port 8000)
$serverProcess = $null
if (-not $port8000) {
    Write-Host "Launching NEPSE metadata API (port 8000)..." -ForegroundColor Cyan
    $serverProcess = Start-Process -FilePath "$venvDir\Scripts\python.exe" -ArgumentList "$scriptDir\nepse_server.py" -NoNewWindow -PassThru
}

# Save PIDs to file for clean shutdown
$pidList = @()
if ($dbProcess) { $pidList += $dbProcess.Id }
if ($serverProcess) { $pidList += $serverProcess.Id }

if ($pidList.Count -gt 0) {
    $pidsString = $pidList -join ","
    $pidsString | Out-File -FilePath "$scriptDir\db\.pids" -Encoding utf8 -Force
}

# 5. Polling-based readiness check (max 10 seconds)
Write-Host "Waiting for servers to bind to ports..." -ForegroundColor DarkGray
$ready = $false
for ($i = 0; $i -lt 20; $i++) {
    $dbActive = Get-NetTCPConnection -LocalPort 5001 -ErrorAction SilentlyContinue
    $serverActive = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
    if ($dbActive -and $serverActive) {
        $ready = $true
        break
    }
    Start-Sleep -Milliseconds 500
}

if ($ready) {
    Write-Host ""
    Write-Host "Services started successfully!" -ForegroundColor Green
    Write-Host "- Portfolio Database: http://localhost:5001" -ForegroundColor Gray
    Write-Host "- NEPSE Server:       http://localhost:8000" -ForegroundColor Gray
} else {
    Write-Host "WARNING: Servers are taking longer than usual to start. Please check the logs if the UI cannot connect." -ForegroundColor Yellow
}
Write-Host ""

# 6. Launch Vite dev server in a new background window
Write-Host "Launching Vite dev server (port 5173)..." -ForegroundColor Cyan
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$scriptDir`" && npm run dev" -WindowStyle Minimized

# 7. Poll http://localhost:5173 until Vite is ready (max 45 seconds)
Write-Host "Waiting for Vite to be ready..." -ForegroundColor DarkGray
$viteReady = $false
for ($j = 0; $j -lt 30; $j++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -ge 100) { $viteReady = $true; break }
    } catch { }
    Start-Sleep -Milliseconds 1500
}

# 8. Open the app in Chrome (fallback to default browser)
$appUrl = "http://localhost:5173"
$chromePaths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
)
$chromeExe = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($chromeExe) {
    Write-Host "Opening app in Chrome: $appUrl" -ForegroundColor Green
    Start-Process -FilePath $chromeExe -ArgumentList $appUrl
} else {
    Write-Host "Chrome not found - opening in default browser: $appUrl" -ForegroundColor Yellow
    Start-Process $appUrl
}
Write-Host ""
