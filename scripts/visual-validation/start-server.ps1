<#
.SYNOPSIS
    Starts a FRESH `next dev` for the redesign iOS visual-validation protocol.
    See docs/visual/VISUAL_VALIDATION_PROTOCOL.md -- this script only implements
    the "start a new server, prove it's the one actually listening" half.

.DESCRIPTION
    Refuses to run if a validation session is already tracked as active, or if
    the target port is already LISTENING to anything -- this protocol exists
    specifically because a stale, silently-reused `next dev` produced a false
    "validated" result during the redesign iOS map (#122 / diagnosis #132).
    Never kills another process automatically; it only ever reports and exits
    non-zero, so a human/agent decides.

    Also refuses to run against a dirty worktree by default (uncommitted
    changes make it ambiguous which code the screenshots actually reflect) --
    pass -AllowDirty to override for deliberate throwaway experiments (never
    for a ticket's real validation).

.PARAMETER Port
    TCP port for `next dev`. Default 3101 (kept off 3000/3001, which the main
    JobApp worktree commonly uses, and off 3100-range ports other worktrees
    have used historically -- see JobApp CLAUDE.md "single dev server" rule,
    which is about not running 2 dev servers against the SAME worktree, not
    about this port specifically).

.PARAMETER WorktreePath
    Path to the redesign iOS worktree. Default is the one and only worktree
    this map works in -- never the main JobApp worktree.

.PARAMETER AllowDirty
    Skip the clean-worktree check. Only for deliberate one-off exploration;
    never use this when validating a ticket for real.

.PARAMETER TimeoutSeconds
    How long to wait for the port to come up and start serving. Default 90s
    (first Next.js dev compile can be slow).

.OUTPUTS
    Writes .visual-validation/session.json (gitignored, not committed) with:
    worktree, branch, head, git_status (raw --short output), launched_pid,
    listening_pid, port, base_url, started_at, log_path. Prints the same
    summary to stdout.

.EXAMPLE
    pwsh scripts/visual-validation/start-server.ps1
    pwsh scripts/visual-validation/start-server.ps1 -Port 3102
#>
[CmdletBinding()]
param(
    [int]$Port = 3101,
    [string]$WorktreePath = "C:\Users\miguel\JobApp-Redesign-iOS",
    [switch]$AllowDirty,
    [int]$TimeoutSeconds = 90
)

$ErrorActionPreference = "Stop"

function Fail($msg) {
    Write-Host "REFUSED: $msg" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $WorktreePath)) {
    Fail "worktree path does not exist: $WorktreePath"
}

Set-Location $WorktreePath

$sessionDir = Join-Path $WorktreePath ".visual-validation"
$sessionFile = Join-Path $sessionDir "session.json"
New-Item -ItemType Directory -Force -Path $sessionDir | Out-Null

# --- Refuse to double-start ------------------------------------------------
if (Test-Path $sessionFile) {
    $existing = Get-Content $sessionFile -Raw | ConvertFrom-Json
    $stillAlive = Get-Process -Id $existing.listening_pid -ErrorAction SilentlyContinue
    if ($stillAlive) {
        Fail "a validation session is already tracked as active (PID $($existing.listening_pid), port $($existing.port), started $($existing.started_at)). Run stop-server.ps1 first -- never reuse a prior session."
    } else {
        Write-Host "Stale session.json found (tracked PID $($existing.listening_pid) is dead) -- removing it and continuing." -ForegroundColor Yellow
        Remove-Item $sessionFile -Force
    }
}

# --- Refuse if the port is already owned by something else -----------------
$portOwner = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($portOwner) {
    $pids = ($portOwner | Select-Object -ExpandProperty OwningProcess -Unique) -join ", "
    Fail "port $Port is already LISTENING (PID(s): $pids). Never reuse a process left over from a prior session -- stop it first (or pick a different -Port)."
}

# --- git state ---------------------------------------------------------
$branch = git rev-parse --abbrev-ref HEAD
$head = git rev-parse HEAD
$statusRaw = git status --short
$isClean = [string]::IsNullOrWhiteSpace($statusRaw)

Write-Host "Worktree : $WorktreePath"
Write-Host "Branch   : $branch"
Write-Host "HEAD     : $head"
Write-Host "Status   : $(if ($isClean) { 'clean' } else { 'DIRTY' })"
if (-not $isClean) {
    Write-Host $statusRaw
}

if (-not $isClean -and -not $AllowDirty) {
    Fail "worktree is dirty. Screenshots must reflect a known, committed HEAD -- commit/stash first, or pass -AllowDirty for deliberate throwaway exploration only (never for a ticket's real validation)."
}

# --- launch ------------------------------------------------------------
$logDir = Join-Path $sessionDir "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path $logDir "next-dev-$timestamp.log"

Write-Host "Starting fresh 'npm run dev -- -p $Port' ..."
$proc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "npm run dev -- -p $Port > `"$logPath`" 2>&1" `
    -WorkingDirectory $WorktreePath `
    -WindowStyle Hidden `
    -PassThru

$launchedPid = $proc.Id
Write-Host "Launched cmd.exe wrapper PID: $launchedPid (log: $logPath)"

# --- wait for the port, then prove ownership ----------------------------
function Get-DescendantPids([int]$rootPid) {
    $all = @($rootPid)
    $frontier = @($rootPid)
    while ($frontier.Count -gt 0) {
        $children = @()
        foreach ($p in $frontier) {
            $children += Get-CimInstance Win32_Process -Filter "ParentProcessId=$p" -ErrorAction SilentlyContinue
        }
        $newPids = $children | Select-Object -ExpandProperty ProcessId | Where-Object { $all -notcontains $_ }
        $all += $newPids
        $frontier = $newPids
    }
    return $all
}

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$listeningPid = $null
while ((Get-Date) -lt $deadline) {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $listeningPid = ($conn | Select-Object -First 1 -ExpandProperty OwningProcess)
        break
    }
    Start-Sleep -Milliseconds 500
}

if (-not $listeningPid) {
    Fail "port $Port never came up listening within $TimeoutSeconds s. See log: $logPath"
}

$tree = Get-DescendantPids -rootPid $launchedPid
if ($tree -notcontains $listeningPid) {
    Fail "port $Port is listening on PID $listeningPid, which is NOT a descendant of the process this script just launched (PID $launchedPid). Refusing to trust this session -- something else grabbed the port. Process tree checked: $($tree -join ', ')"
}

Write-Host "Port $Port confirmed owned by PID $listeningPid (descendant of launched PID $launchedPid)." -ForegroundColor Green

# --- wait for HTTP readiness on both routes this protocol needs ------------
$baseUrl = "http://localhost:$Port"
$routes = @("/dev-preview/app", "/dev-preview/ios")
foreach ($route in $routes) {
    $ok = $false
    $routeDeadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $routeDeadline) {
        try {
            $resp = Invoke-WebRequest -Uri "$baseUrl$route" -UseBasicParsing -TimeoutSec 5
            if ($resp.StatusCode -eq 200) { $ok = $true; break }
        } catch {
            Start-Sleep -Milliseconds 750
        }
    }
    if (-not $ok) {
        Fail "$route never returned 200 within $TimeoutSeconds s. See log: $logPath"
    }
    Write-Host "$route -> 200 OK" -ForegroundColor Green
}

# --- record session ------------------------------------------------------
$session = [ordered]@{
    worktree      = $WorktreePath
    branch        = $branch
    head          = $head
    git_status    = $statusRaw
    git_clean     = $isClean
    launched_pid  = $launchedPid
    listening_pid = $listeningPid
    port          = $Port
    base_url      = $baseUrl
    started_at    = (Get-Date).ToString("o")
    log_path      = $logPath
}
$session | ConvertTo-Json | Set-Content -Path $sessionFile -Encoding utf8

Write-Host ""
Write-Host "=== Session ready ===" -ForegroundColor Cyan
$session | Format-List
Write-Host "Session file: $sessionFile"
Write-Host "Next: capture screenshots per docs/visual/VISUAL_VALIDATION_PROTOCOL.md, then run stop-server.ps1."
