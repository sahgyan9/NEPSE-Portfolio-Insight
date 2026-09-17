# Portfolio Nepse - Clean Uninstaller Script
# Removes shortcuts, registry entries, and program registrations
# Preserves user portfolio databases by default
param(
    [switch]$Silent = $false
)

$ErrorActionPreference = "Continue"

function Test-IsInteractive {
    return [Environment]::UserInteractive -and -not $Silent
}

# 1. Prompt User for Confirmation if Interactive
if (Test-IsInteractive) {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing

    $form = New-Object System.Windows.Forms.Form
    $form.Text = "Uninstall Portfolio Nepse"
    $form.Size = New-Object System.Drawing.Size(460, 240)
    $form.StartPosition = "CenterScreen"
    $form.FormBorderStyle = "FixedDialog"
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false

    $lblTitle = New-Object System.Windows.Forms.Label
    $lblTitle.Text = "Are you sure you want to uninstall Portfolio Nepse?"
    $lblTitle.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
    $lblTitle.Location = New-Object System.Drawing.Point(20, 20)
    $lblTitle.Size = New-Object System.Drawing.Size(400, 30)
    $form.Controls.Add($lblTitle)

    $lblDesc = New-Object System.Windows.Forms.Label
    $lblDesc.Text = "This will remove Portfolio Nepse shortcuts, Start Menu integration, and Windows registration. Your portfolio data files in db/ are safely preserved."
    $lblDesc.Font = New-Object System.Drawing.Font("Segoe UI", 9)
    $lblDesc.Location = New-Object System.Drawing.Point(20, 55)
    $lblDesc.Size = New-Object System.Drawing.Size(400, 45)
    $form.Controls.Add($lblDesc)

    $btnUninstall = New-Object System.Windows.Forms.Button
    $btnUninstall.Text = "Uninstall"
    $btnUninstall.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
    $btnUninstall.Location = New-Object System.Drawing.Point(230, 145)
    $btnUninstall.Size = New-Object System.Drawing.Size(95, 32)
    $btnUninstall.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $form.Controls.Add($btnUninstall)

    $btnCancel = New-Object System.Windows.Forms.Button
    $btnCancel.Text = "Cancel"
    $btnCancel.Font = New-Object System.Drawing.Font("Segoe UI", 9)
    $btnCancel.Location = New-Object System.Drawing.Point(335, 145)
    $btnCancel.Size = New-Object System.Drawing.Size(85, 32)
    $btnCancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
    $form.Controls.Add($btnCancel)

    $form.AcceptButton = $btnUninstall
    $form.CancelButton = $btnCancel

    $result = $form.ShowDialog()
    if ($result -ne [System.Windows.Forms.DialogResult]::OK) {
        Write-Host "Uninstallation cancelled by user."
        exit 0
    }
}

Write-Host "Starting Portfolio Nepse uninstallation..." -ForegroundColor Cyan

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

# 2. Stop running Portfolio Nepse processes
Write-Host "Stopping any running instances..." -ForegroundColor DarkGray
foreach ($port in @(5001, 8000, 5175)) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        foreach ($conn in $conns) {
            if ($conn.OwningProcess -and $conn.OwningProcess -gt 4) {
                Start-Process -FilePath "taskkill.exe" -ArgumentList "/F /T /PID $($conn.OwningProcess)" -NoNewWindow -Wait -ErrorAction SilentlyContinue
            }
        }
    } catch {}
}

# 3. Remove Desktop, Start Menu, and Project Root Shortcuts
Write-Host "Removing shortcuts..." -ForegroundColor DarkGray
$desktopShortcut = [System.IO.Path]::Combine([System.Environment]::GetFolderPath('Desktop'), "Portfolio Nepse.lnk")
$startMenuShortcut = [System.IO.Path]::Combine($env:APPDATA, "Microsoft\Windows\Start Menu\Programs\Portfolio Nepse.lnk")
$altDesktopShortcut = [System.IO.Path]::Combine($env:USERPROFILE, "Desktop\Portfolio Nepse.lnk")
$projectShortcut = [System.IO.Path]::Combine($ProjectRoot, "Portfolio Nepse.lnk")
$oneDriveDesktop = if ($env:OneDrive) { [System.IO.Path]::Combine($env:OneDrive, "Desktop\Portfolio Nepse.lnk") } else { $null }

$allShortcuts = @($desktopShortcut, $startMenuShortcut, $altDesktopShortcut, $projectShortcut)
if ($oneDriveDesktop) { $allShortcuts += $oneDriveDesktop }

foreach ($s in $allShortcuts) {
    if (Test-Path $s) {
        try {
            Remove-Item -LiteralPath $s -Force -ErrorAction SilentlyContinue
            Write-Host "Removed shortcut: $s" -ForegroundColor Gray
        } catch {}
    }
}

# 4. Remove Windows Registry entries
Write-Host "Removing registry registrations..." -ForegroundColor DarkGray
$uninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\PortfolioNepse"
if (Test-Path $uninstallKey) {
    try { Remove-Item -Path $uninstallKey -Recurse -Force -ErrorAction SilentlyContinue } catch {}
}

$appPathsKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\portfolio-nepse.exe"
if (Test-Path $appPathsKey) {
    try { Remove-Item -Path $appPathsKey -Recurse -Force -ErrorAction SilentlyContinue } catch {}
}

# 5. Refresh Windows Icon Cache
Write-Host "Refreshing Windows icon cache..." -ForegroundColor Cyan
try {
    if (-not ([System.Management.Automation.PSTypeName]'Win32.ShellNotification').Type) {
        $code = @'
        [System.Runtime.InteropServices.DllImport("Shell32.dll")]
        public static extern void SHChangeNotify(int eventId, int flags, IntPtr item1, IntPtr item2);
'@
        Add-Type -MemberDefinition $code -Name "ShellNotification" -Namespace "Win32" -ErrorAction SilentlyContinue
    }
    [Win32.ShellNotification]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
} catch {}

Write-Host ""
Write-Host "Portfolio Nepse has been successfully removed from Windows." -ForegroundColor Green
