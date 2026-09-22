<#
.SYNOPSIS
    Stops the `next dev` started by start-server.ps1 and clears the tracked
    session, so the next run of start-server.ps1 is guaranteed a fresh start.

.DESCRIPTION
    Reads .visual-validation/session.json, kills the recorded listening PID
    (and the launched wrapper PID, if still alive and different), verifies
    the port is actually free afterwards, archives the session file with a
    stopped_at timestamp, and removes the active session.json.

    Safe to run with no active session (reports and exits 0) -- makes it
    safe to call defensively at the start of a new capture round.

.PARAMETER WorktreePath
    Path to the redesign iOS worktree. Must match what start-server.ps1 used.

.EXAMPLE
    pwsh scripts/visual-validation/stop-server.ps1
#>
[CmdletBinding()]
param(
    [string]$WorktreePath = "C:\Users\miguel\JobApp-Redesign-iOS"
)

$ErrorActionPreference = "Stop"

$sessionDir = Join-Path $WorktreePath ".visual-validation"
$sessionFile = Join-Path $sessionDir "session.json"

if (-not (Test-Path $sessionFile)) {
    Write-Host "No active session.json -- nothing to stop." -ForegroundColor Yellow
    exit 0
}

$session = Get-Content $sessionFile -Raw | ConvertFrom-Json

$toKill = @($session.listening_pid, $session.launched_pid) | Select-Object -Unique
foreach ($procId in $toKill) {
    $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($p) {
        Write-Host "Stopping PID $procId ($($p.ProcessName))..."
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
}

Start-Sleep -Milliseconds 500

$stillListening = Get-NetTCPConnection -LocalPort $session.port -State Listen -ErrorAction SilentlyContinue
if ($stillListening) {
    Write-Host "WARNING: port $($session.port) still shows a LISTENER after stop: PID(s) $(($stillListening | Select-Object -ExpandProperty OwningProcess -Unique) -join ', ')" -ForegroundColor Red
} else {
    Write-Host "Port $($session.port) confirmed free." -ForegroundColor Green
}

$archiveDir = Join-Path $sessionDir "archive"
New-Item -ItemType Directory -Force -Path $archiveDir | Out-Null
$stoppedAt = (Get-Date).ToString("o")
$session | Add-Member -NotePropertyName stopped_at -NotePropertyValue $stoppedAt -Force
$archiveName = "session-$((Get-Date $session.started_at).ToString('yyyyMMdd-HHmmss')).json"
$session | ConvertTo-Json | Set-Content -Path (Join-Path $archiveDir $archiveName) -Encoding utf8

Remove-Item $sessionFile -Force

Write-Host "Session stopped and archived to $archiveDir\$archiveName"
