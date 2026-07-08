# Portfolio Insight - Stop Services
# This script kills any running background Python servers

Write-Host ""
Write-Host "Stopping Portfolio Insight background services..." -ForegroundColor Yellow

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidsFile = "$scriptDir\db\.pids"
$killedCount = 0

# 1. Try stopping tracked PIDs first
if (Test-Path $pidsFile) {
    try {
        $pidsContent = Get-Content -Path $pidsFile -ErrorAction SilentlyContinue
        if ($pidsContent) {
            $pidList = $pidsContent.Split(",")
            foreach ($pStr in $pidList) {
                $pId = 0
                if ([int]::TryParse($pStr.Trim(), [ref]$pId)) {
                    $proc = Get-Process -Id $pId -ErrorAction SilentlyContinue
                    if ($proc) {
                        Stop-Process -Id $pId -Force -ErrorAction SilentlyContinue
                        Write-Host "Killed tracked process $($pId): $($proc.Name)" -ForegroundColor Gray
                        $killedCount++
                    }
                }
            }
        }
    } finally {
        Remove-Item -Path $pidsFile -Force -ErrorAction SilentlyContinue
    }
}

# 2. Fallback to scanning active python command lines
$pythonProcesses = Get-CimInstance Win32_Process -Filter "Name = 'python.exe' OR Name = 'pythonw.exe'" -ErrorAction SilentlyContinue

foreach ($proc in $pythonProcesses) {
    $cmdLine = $proc.CommandLine
    if ($cmdLine -and ($cmdLine.Contains("portfolio_db.py") -or $cmdLine.Contains("nepse_server.py"))) {
        # Check if we didn't already stop it
        $procExists = Get-Process -Id $proc.ProcessId -ErrorAction SilentlyContinue
        if ($procExists) {
            Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
            Write-Host "Killed process $($proc.ProcessId): $($proc.Name) ($($proc.CommandLine))" -ForegroundColor Gray
            $killedCount++
        }
    }
}

if ($killedCount -gt 0) {
    Write-Host "Successfully stopped $killedCount background service(s)." -ForegroundColor Green
} else {
    Write-Host "No active background services found to stop." -ForegroundColor Gray
}
Write-Host ""
