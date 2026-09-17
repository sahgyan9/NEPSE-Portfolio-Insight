[CmdletBinding()]
param(
    [switch]$NoSplash
)

$ErrorActionPreference = "SilentlyContinue"

# Pre-load Forms and Drawing assemblies
Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue
Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue

# Robust project root detection and working directory set
if ($PSScriptRoot -and (Test-Path $PSScriptRoot)) {
    $scriptDir = $PSScriptRoot
} elseif ($MyInvocation.MyCommand.Path) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
} else {
    $scriptDir = (Get-Location).Path
}

$ProjectRoot = Split-Path -Parent $scriptDir
if (-not (Test-Path "$ProjectRoot\package.json")) {
    $ProjectRoot = $scriptDir
}
Set-Location $ProjectRoot

$LogDir = Join-Path $ProjectRoot "logs"
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}
$LogFile = Join-Path $LogDir "portfolio_nepse.log"

function Log-Message([string]$Msg) {
    try {
        $time = Get-Date -Format 'HH:mm:ss.fff'
        "[$time] $Msg" | Out-File -FilePath $LogFile -Append -Encoding utf8
    } catch {}
}

# Refresh environment PATH from registry in case Node or Python was recently installed
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

$script:IconBase64 = "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"

# ------------------------------------------------------------------
# Dual Check: Direct TCP Socket + Get-NetTCPConnection (Universal)
# ------------------------------------------------------------------
function Test-PortOpen([int]$Port) {
    # 1. Direct TCP Socket Check (fastest and most reliable across all Windows versions)
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $async = $tcp.BeginConnect("127.0.0.1", $Port, $null, $null)
        $wait = $async.AsyncWaitHandle.WaitOne(150)
        if ($wait -and $tcp.Connected) {
            $tcp.EndConnect($async)
            $tcp.Close()
            return $true
        }
        $tcp.Close()
    } catch {}

    # 2. Get-NetTCPConnection check (listen state only)
    try {
        $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($conns) { return $true }
    } catch {}

    return $false
}

function Show-ErrorDialog {
    param([string]$Title, [string]$Message)
    [System.Windows.Forms.MessageBox]::Show(
        $Message,
        $Title,
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
}

function Open-InChrome {
    param([string]$Url)

    # 1. Prioritize Google Chrome
    $chromeCandidates = @(
        (Get-Command chrome.exe -ErrorAction SilentlyContinue).Source,
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique

    $chromePath = $chromeCandidates | Select-Object -First 1
    if ($chromePath) {
        Start-Process -FilePath $chromePath -ArgumentList $Url
        return
    }

    # 2. Fallback to Edge
    $edgeCandidates = @(
        (Get-Command msedge.exe -ErrorAction SilentlyContinue).Source,
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
    ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique

    $edgePath = $edgeCandidates | Select-Object -First 1
    if ($edgePath) {
        Start-Process -FilePath $edgePath -ArgumentList $Url
        return
    }

    # 3. Fallback to system default browser
    Start-Process $Url
}

# ------------------------------------------------------------------
# STEP 1: Fast Warm Check (If already running, open in <50ms!)
# ------------------------------------------------------------------
Log-Message "STEP 1: Performing fast warm check..."
$isWarmDb     = Test-PortOpen 5001
$isWarmServer = Test-PortOpen 8000
$isWarmVite   = Test-PortOpen 5175
Log-Message "Warm status: DB(:5001)=$isWarmDb, Server(:8000)=$isWarmServer, Vite(:5175)=$isWarmVite"

if ($isWarmDb -and $isWarmServer -and $isWarmVite) {
    Log-Message "All services active - opening browser at http://localhost:5175"
    Open-InChrome "http://localhost:5175"
    exit 0
}

# ------------------------------------------------------------------
# STEP 2: Instant Native Splash Screen
# ------------------------------------------------------------------
$splash = $null
$lblStatus = $null

if (-not $NoSplash) {
    try {
        [System.Windows.Forms.Application]::EnableVisualStyles()

        $splash = New-Object System.Windows.Forms.Form
        $splash.FormBorderStyle = "None"
        $splash.StartPosition = "CenterScreen"
        $splash.Size = New-Object System.Drawing.Size(390, 146)
        $splash.BackColor = [System.Drawing.Color]::FromArgb(8, 12, 10) # Brand dark emerald #080C0A
        $splash.TopMost = $true
        $splash.ShowInTaskbar = $false

        $borderPanel = New-Object System.Windows.Forms.Panel
        $borderPanel.Dock = "Fill"
        $borderPanel.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
        $splash.Controls.Add($borderPanel)

        # Load Logo Image
        $img = $null
        $iconPngPath = Join-Path $ProjectRoot "assets\icon.png"
        if (Test-Path $iconPngPath) {
            try { $img = [System.Drawing.Image]::FromFile($iconPngPath) } catch {}
        }
        if (-not $img) {
            try {
                [byte[]]$bytes = [Convert]::FromBase64String($script:IconBase64)
                $ms = New-Object System.IO.MemoryStream
                $ms.Write($bytes, 0, $bytes.Length)
                $ms.Position = 0
                $img = [System.Drawing.Image]::FromStream($ms)
            } catch {}
        }

        if ($img) {
            $picLogo = New-Object System.Windows.Forms.PictureBox
            $picLogo.Size = New-Object System.Drawing.Size(46, 46)
            $picLogo.Location = New-Object System.Drawing.Point(22, 18)
            $picLogo.SizeMode = [System.Windows.Forms.PictureBoxSizeMode]::Zoom
            $picLogo.Image = $img
            $borderPanel.Controls.Add($picLogo)

            try {
                $bmp = New-Object System.Drawing.Bitmap($img)
                $splash.Icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
            } catch {}
        }

        # App Title: "Portfolio Nepse"
        $lblTitle = New-Object System.Windows.Forms.Label
        $lblTitle.Text = "Portfolio Nepse"
        $lblTitle.Font = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
        $lblTitle.ForeColor = [System.Drawing.Color]::FromArgb(238, 243, 240)
        $lblTitle.Location = New-Object System.Drawing.Point(78, 16)
        $lblTitle.AutoSize = $true
        $borderPanel.Controls.Add($lblTitle)

        # Subtitle: "Intelligent NEPSE Analysis"
        $lblSub = New-Object System.Windows.Forms.Label
        $lblSub.Text = "Intelligent NEPSE Analysis"
        $lblSub.Font = New-Object System.Drawing.Font("Segoe UI", 8.5)
        $lblSub.ForeColor = [System.Drawing.Color]::FromArgb(142, 155, 148)
        $lblSub.Location = New-Object System.Drawing.Point(80, 44)
        $lblSub.AutoSize = $true
        $borderPanel.Controls.Add($lblSub)

        # Real-time Status Label
        $lblStatus = New-Object System.Windows.Forms.Label
        $lblStatus.Text = "Initializing services..."
        $lblStatus.Font = New-Object System.Drawing.Font("Segoe UI", 8.5)
        $lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(51, 204, 140) # Brand Emerald #33CC8C
        $lblStatus.Location = New-Object System.Drawing.Point(22, 80)
        $lblStatus.Size = New-Object System.Drawing.Size(346, 18)
        $borderPanel.Controls.Add($lblStatus)

        # Progress Bar
        $pb = New-Object System.Windows.Forms.ProgressBar
        $pb.Style = [System.Windows.Forms.ProgressBarStyle]::Marquee
        $pb.MarqueeAnimationSpeed = 25
        $pb.Location = New-Object System.Drawing.Point(22, 106)
        $pb.Size = New-Object System.Drawing.Size(346, 8)
        $borderPanel.Controls.Add($pb)

        $splash.Show()
        [System.Windows.Forms.Application]::DoEvents()
    } catch {}
}

function Update-Splash([string]$StatusText) {
    if ($script:lblStatus) {
        try {
            $script:lblStatus.Text = $StatusText
            [System.Windows.Forms.Application]::DoEvents()
        } catch {}
    }
}

# ------------------------------------------------------------------
# STEP 3: Dependency Checks
# ------------------------------------------------------------------
Log-Message "STEP 3: Checking dependencies..."
Update-Splash "Checking environment (.venv & Node.js)..."

$venvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Log-Message "ERROR: Python .venv not found at $venvPython"
    if ($splash) { $splash.Close() }
    Show-ErrorDialog "Portfolio Nepse - Virtual Environment Not Found" (
        "Python virtual environment (.venv) was not found at:`n$venvPython`n`n" +
        "Please set up the virtual environment before launching Portfolio Nepse."
    )
    exit 1
}

$nodeCmd = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $nodeCmd) { $nodeCmd = Get-Command node -ErrorAction SilentlyContinue }
if (-not $nodeCmd) {
    Log-Message "ERROR: Node.js command not found"
    if ($splash) { $splash.Close() }
    Show-ErrorDialog "Portfolio Nepse - Node.js Not Found" (
        "Portfolio Nepse needs Node.js to run the UI, but it was not found on this system.`n`n" +
        "Please install Node.js from: https://nodejs.org"
    )
    exit 1
}

# Ensure node_modules exists
$nodeModulesPath = Join-Path $ProjectRoot "node_modules"
if (-not (Test-Path $nodeModulesPath)) {
    Log-Message "node_modules missing, running npm install..."
    Update-Splash "First-time setup: installing dependencies (1-2 min)..."
    $npmInstall = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c npm install" `
        -WorkingDirectory $ProjectRoot -Wait -PassThru -WindowStyle Hidden
    
    if ($npmInstall.ExitCode -ne 0 -or -not (Test-Path $nodeModulesPath)) {
        Log-Message "ERROR: npm install failed"
        if ($splash) { $splash.Close() }
        Show-ErrorDialog "Portfolio Nepse - Dependency Install Failed" (
            "npm install failed. Portfolio Nepse cannot start without its dependencies."
        )
        exit 1
    }
}

# ------------------------------------------------------------------
# STEP 4: Smart Non-Destructive Service Startup
# ------------------------------------------------------------------
Log-Message "STEP 4: Launching background services..."

# Check which services are missing and launch ONLY what is needed
if (-not $isWarmDb) {
    Log-Message "Starting Portfolio Database (:5001)..."
    Update-Splash "Starting Portfolio Database (:5001)..."
    $pDb = Start-Process -FilePath $venvPython -ArgumentList "`"$ProjectRoot\portfolio_db.py`"" -WorkingDirectory $ProjectRoot -WindowStyle Hidden -PassThru
    Log-Message "Database launched with PID: $($pDb.Id)"
}

if (-not $isWarmServer) {
    Log-Message "Starting NEPSE Market API (:8000)..."
    Update-Splash "Starting NEPSE Market API (:8000)..."
    $pServer = Start-Process -FilePath $venvPython -ArgumentList "`"$ProjectRoot\nepse_server.py`"" -WorkingDirectory $ProjectRoot -WindowStyle Hidden -PassThru
    Log-Message "NEPSE Server launched with PID: $($pServer.Id)"
}

if (-not $isWarmVite) {
    Log-Message "Starting Portfolio Dashboard (:5175)..."
    Update-Splash "Starting Portfolio Dashboard (:5175)..."
    $pVite = Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$ProjectRoot`" && npm run dev" -WorkingDirectory $ProjectRoot -WindowStyle Hidden -PassThru
    Log-Message "Vite dev server launched with PID: $($pVite.Id)"
}

# ------------------------------------------------------------------
# STEP 5: High-Speed Polling Loop
# ------------------------------------------------------------------
Log-Message "STEP 5: Starting polling loop..."
$allReady = $false
for ($i = 0; $i -lt 40; $i++) {
    [System.Windows.Forms.Application]::DoEvents()
    
    if (-not $isWarmDb)     { $isWarmDb = Test-PortOpen 5001 }
    if (-not $isWarmServer) { $isWarmServer = Test-PortOpen 8000 }
    if (-not $isWarmVite)   {
        try {
            $res = Invoke-WebRequest -Uri "http://localhost:5175" -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
            if ($res -and $res.StatusCode -ge 100) { $isWarmVite = $true }
        } catch {}
        if (-not $isWarmVite) { $isWarmVite = Test-PortOpen 5175 }
    }

    if ($i % 5 -eq 0) {
        Log-Message "Polling iteration $($i) - DB(:5001)=$isWarmDb, Server(:8000)=$isWarmServer, Vite(:5175)=$isWarmVite"
    }

    if ($isWarmDb -and $isWarmServer -and $isWarmVite) {
        Log-Message "All services verified active after $($i * 500) ms"
        $allReady = $true
        break
    }

    if ($i -eq 4) {
        Update-Splash "Connecting to database (:5001)..."
    } elseif ($i -eq 10) {
        Update-Splash "Connecting to NEPSE live engine (:8000)..."
    } elseif ($i -eq 16) {
        Update-Splash "Warming dashboard interface (:5175)..."
    }

    Start-Sleep -Milliseconds 500
}

# ------------------------------------------------------------------
# STEP 6: Browser Launch & Clean Exit
# ------------------------------------------------------------------
if ($allReady) {
    Log-Message "STEP 6: Launching browser at http://localhost:5175..."
    Update-Splash "Portfolio Nepse ready! Opening browser..."
    
    # Pre-warm Vite in memory before opening Chrome for instant 0ms page render
    try {
        $wc = New-Object System.Net.WebClient
        $null = $wc.DownloadString("http://127.0.0.1:5175/")
        $wc.Dispose()
    } catch {}

    Open-InChrome "http://localhost:5175"
    Log-Message "Browser command sent. Closing splash screen."
    Start-Sleep -Milliseconds 400
    if ($splash) { $splash.Close() }
    Log-Message "Session ended successfully."
    exit 0
} else {
    Log-Message "STEP 6: Startup timed out."
    if ($splash) { $splash.Close() }

    $missingParts = @()
    if (-not $isWarmDb)     { $missingParts += "Portfolio Database (port 5001)" }
    if (-not $isWarmServer) { $missingParts += "NEPSE Server (port 8000)" }
    if (-not $isWarmVite)   { $missingParts += "Dashboard UI (port 5175)" }
    $missingText = $missingParts -join ", "
    Log-Message "Startup failed. Missing: $missingText"

    Show-ErrorDialog "Portfolio Nepse - Startup Failed" (
        "$missingText did not become ready within the expected time.`n`n" +
        "Please run 'Portfolio-Nepse-Setup.bat' or check the terminal logs."
    )
    exit 1
}
