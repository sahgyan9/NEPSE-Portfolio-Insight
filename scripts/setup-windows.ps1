# Portfolio Nepse - Windows Integration Script
# Creates Start Menu, Desktop shortcuts, and Uninstaller registration
param(
    [switch]$NoDesktop = $false,
    [switch]$NoStartMenu = $false
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$StartMenuPath = [System.IO.Path]::Combine($env:APPDATA, "Microsoft\Windows\Start Menu\Programs")
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')
$AltDesktopPath = [System.IO.Path]::Combine($env:USERPROFILE, "Desktop")
$OneDriveDesktop = if ($env:OneDrive) { [System.IO.Path]::Combine($env:OneDrive, "Desktop") } else { $null }

# 1. Compile fresh multi-resolution icons from assets/icon.svg if Node and generator exist
$IconGenerator = [System.IO.Path]::Combine($ProjectRoot, "scripts\generate-icons.cjs")
if (Test-Path $IconGenerator) {
    try {
        Write-Host "Compiling fresh multi-resolution icons from assets\icon.svg..." -ForegroundColor Cyan
        & node $IconGenerator
    } catch {
        Write-Warning "Could not compile icons: $_"
    }
}

$VbsLauncher = [System.IO.Path]::Combine($ProjectRoot, "scripts\launch.vbs")
$IconPath = [System.IO.Path]::Combine($ProjectRoot, "assets\icon.ico")

Write-Host "Setting up Portfolio Nepse shortcuts with custom brand icon..." -ForegroundColor Cyan

$WshShell = New-Object -ComObject WScript.Shell

$TargetLocations = @(
    @{ Name = "Project Folder"; Path = [System.IO.Path]::Combine($ProjectRoot, "Portfolio Nepse.lnk") }
)

if (-not $NoStartMenu) {
    $TargetLocations += @{ Name = "Start Menu (Windows Search)"; Path = [System.IO.Path]::Combine($StartMenuPath, "Portfolio Nepse.lnk") }
}

if (-not $NoDesktop) {
    $TargetLocations += @{ Name = "Desktop"; Path = [System.IO.Path]::Combine($DesktopPath, "Portfolio Nepse.lnk") }
    if ($AltDesktopPath -ne $DesktopPath -and (Test-Path $AltDesktopPath)) {
        $TargetLocations += @{ Name = "User Desktop"; Path = [System.IO.Path]::Combine($AltDesktopPath, "Portfolio Nepse.lnk") }
    }
    if ($OneDriveDesktop -and (Test-Path $OneDriveDesktop) -and ($OneDriveDesktop -ne $DesktopPath)) {
        $TargetLocations += @{ Name = "OneDrive Desktop"; Path = [System.IO.Path]::Combine($OneDriveDesktop, "Portfolio Nepse.lnk") }
    }
}

foreach ($loc in $TargetLocations) {
    if (Test-Path $loc.Path) {
        Remove-Item $loc.Path -Force -ErrorAction SilentlyContinue
    }

    $Shortcut = $WshShell.CreateShortcut($loc.Path)
    $Shortcut.TargetPath = "wscript.exe"
    $Shortcut.Arguments = "`"$VbsLauncher`""
    $Shortcut.WorkingDirectory = $ProjectRoot
    $Shortcut.Description = "Portfolio Nepse - Intelligent NEPSE Stock Portfolio Tracker & Valuation Insights"

    if (Test-Path $IconPath) {
        $Shortcut.IconLocation = "$IconPath,0"
    }

    $Shortcut.Save()
    (Get-Item $loc.Path).LastWriteTime = Get-Date
    Write-Host "[+] Created shortcut in $($loc.Name): $($loc.Path)" -ForegroundColor Green
}

# 2. Register Uninstaller in Windows Settings -> Installed Apps
try {
    Write-Host "Registering in Windows Installed Apps & Features..." -ForegroundColor Cyan
    $uninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\PortfolioNepse"
    if (-not (Test-Path $uninstallKey)) {
        New-Item -Path $uninstallKey -Force | Out-Null
    }
    $uninstallBat = Join-Path $ProjectRoot "Uninstall-Portfolio-Nepse.bat"
    $uninstallPs1 = Join-Path $ProjectRoot "scripts\uninstall.ps1"

    Set-ItemProperty -Path $uninstallKey -Name "DisplayName" -Value "Portfolio Nepse"
    Set-ItemProperty -Path $uninstallKey -Name "DisplayVersion" -Value "1.0.0"
    Set-ItemProperty -Path $uninstallKey -Name "Publisher" -Value "Portfolio Nepse"
    Set-ItemProperty -Path $uninstallKey -Name "InstallLocation" -Value $ProjectRoot
    if (Test-Path $IconPath) { Set-ItemProperty -Path $uninstallKey -Name "DisplayIcon" -Value "$IconPath,0" }
    Set-ItemProperty -Path $uninstallKey -Name "UninstallString" -Value "`"$uninstallBat`""
    Set-ItemProperty -Path $uninstallKey -Name "QuietUninstallString" -Value "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$uninstallPs1`" -Silent"
    Set-ItemProperty -Path $uninstallKey -Name "EstimatedSize" -Value 350000 -Type DWord
    Set-ItemProperty -Path $uninstallKey -Name "NoModify" -Value 1 -Type DWord
    Set-ItemProperty -Path $uninstallKey -Name "NoRepair" -Value 1 -Type DWord
    Write-Host "[+] Registered 'Portfolio Nepse' in Windows Installed Apps" -ForegroundColor Green
} catch {
    Write-Warning "Could not register in registry: $_"
}

# 3. Register App Execution Alias in HKCU App Paths for instant Run (Win+R) & search indexing
try {
    foreach ($alias in @("portfolio-nepse.exe", "portfolionepse.exe")) {
        $appPathsKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\$alias"
        if (-not (Test-Path $appPathsKey)) {
            New-Item -Path $appPathsKey -Force | Out-Null
        }
        Set-ItemProperty -Path $appPathsKey -Name "(Default)" -Value "wscript.exe `"$VbsLauncher`""
        Set-ItemProperty -Path $appPathsKey -Name "Path" -Value $ProjectRoot
    }
} catch {}

# 4. Invalidate Windows Shell icon cache
Write-Host "Refreshing Windows icon cache..." -ForegroundColor Cyan
try {
    if (-not ([System.Management.Automation.PSTypeName]'Win32.ShellNotification').Type) {
        $code = @'
        [System.Runtime.InteropServices.DllImport("Shell32.dll")]
        public static extern void SHChangeNotify(int eventId, int flags, IntPtr item1, IntPtr item2);
'@
        Add-Type -MemberDefinition $code -Name "ShellNotification" -Namespace "Win32" -ErrorAction SilentlyContinue
    }
    [Win32.ShellNotification]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero) # SHCNE_ASSOCCHANGED
} catch {}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "PORTFOLIO NEPSE IS READY!" -ForegroundColor Green
Write-Host "1. Press Windows Key and search 'portfolio nepse' to open." -ForegroundColor Cyan
Write-Host "2. Or double-click the 'Portfolio Nepse' shortcut on Desktop." -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Green
