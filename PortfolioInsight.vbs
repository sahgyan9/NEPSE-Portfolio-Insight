' Portfolio Insight Launcher
' Double-click or pin to taskbar to start all services

Set WshShell = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)

' Start Portfolio Database Server (minimized)
WshShell.Run """" & scriptDir & "\.venv\Scripts\python.exe"" """ & scriptDir & "\portfolio_db.py""", 7, False

' Start NEPSE Data Server (minimized)  
WshShell.Run """" & scriptDir & "\.venv\Scripts\python.exe"" """ & scriptDir & "\nepse_server.py""", 7, False

' Wait for servers to start
WScript.Sleep 2000

' Start Vite Dev Server (normal window)
WshShell.Run "cmd /c cd /d """ & scriptDir & """ && npm run dev", 1, False

' Open browser after a short delay
WScript.Sleep 3000
WshShell.Run "http://localhost:8080", 1, False
