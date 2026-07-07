# Portfolio Insight - Stop All Services
# This script stops all Python servers

Write-Host ""
Write-Host "Stopping Portfolio Insight services..." -ForegroundColor Yellow

# Find and stop Python processes running our servers
$pythonProcesses = Get-Process python -ErrorAction SilentlyContinue

if ($pythonProcesses) {
    foreach ($proc in $pythonProcesses) {
        try {
            $proc | Stop-Process -Force
            Write-Host "Stopped Python process: $($proc.Id)" -ForegroundColor Gray
        } catch {
            Write-Host "Could not stop process: $($proc.Id)" -ForegroundColor Red
        }
    }
    Write-Host ""
    Write-Host "All Python servers stopped." -ForegroundColor Green
} else {
    Write-Host "No Python servers running." -ForegroundColor Gray
}

Write-Host ""
