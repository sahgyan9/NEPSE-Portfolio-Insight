' Silent Windows Launcher for Portfolio Nepse
' Sets correct working directory and delegates to launch.ps1 with completely hidden window style

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectRoot = fso.GetParentFolderName(scriptDir)
WshShell.CurrentDirectory = projectRoot

psScript = fso.BuildPath(scriptDir, "launch.ps1")
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & psScript & """"
WshShell.Run cmd, 0, False
