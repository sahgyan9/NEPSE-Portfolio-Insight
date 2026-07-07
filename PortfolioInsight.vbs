' Portfolio Insight Launcher
' Double-click or pin to taskbar to start all services

Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
scriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)

' Start Portfolio Database Server (minimized)
WshShell.Run """" & scriptDir & "\.venv\Scripts\python.exe"" """ & scriptDir & "\portfolio_db.py""", 7, False

' Start NEPSE Data Server (minimized)
WshShell.Run """" & scriptDir & "\.venv\Scripts\python.exe"" """ & scriptDir & "\nepse_server.py""", 7, False

' Wait for Python servers to initialise before Vite starts
WScript.Sleep 2500

' Start Vite Dev Server (normal window, background)
WshShell.Run "cmd /c cd /d """ & scriptDir & """ && npm run dev", 1, False

' ---------------------------------------------------------------
' Poll http://localhost:5173 until Vite is ready (max 45 seconds)
' ---------------------------------------------------------------
Dim maxWait, waited, viteReady
maxWait = 45000
waited  = 0
viteReady = False

Do While waited < maxWait And Not viteReady
    WScript.Sleep 1500
    waited = waited + 1500
    On Error Resume Next
    Dim http
    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    If Err.Number <> 0 Then
        Set http = CreateObject("MSXML2.XMLHTTP.6.0")
    End If
    Err.Clear
    http.Open "GET", "http://localhost:5173", False
    http.setTimeouts 1000, 1000, 1000, 1000
    http.Send
    If Err.Number = 0 And http.Status >= 100 Then
        viteReady = True
    End If
    Set http = Nothing
    On Error GoTo 0
Loop

' Open browser once Vite is ready (or after timeout)
WshShell.Run "http://localhost:5173", 1, False
