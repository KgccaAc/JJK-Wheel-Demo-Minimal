param(
    [int]$Port = 8095,
    [string]$Artifact = "",
    [switch]$Headed,
    [switch]$CreateRoom,
    [ValidateSet(1, 2)]
    [int]$Pages = 2
)

$ErrorActionPreference = "Stop"
$project = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($Artifact)) {
    $Artifact = Join-Path $project "reports\web-acceptance\20260918-205958"
}
$required = @("index.html", "index.js", "index.pck", "index.wasm")
foreach ($file in $required) {
    if (-not (Test-Path (Join-Path $Artifact $file))) {
        throw "Web artifact is incomplete: $(Join-Path $Artifact $file)"
    }
}

$env:LOCAL_PREVIEW_PORT = "$Port"
$env:LOCAL_PREVIEW_WEB_ROOT = $Artifact
# This is a public API bridge for browser CORS and WebSocket same-origin rules.
# It never points at a server-internal port.
$env:LOCAL_PREVIEW_REMOTE_ROOM_PREFIX = "/preview-room-api"
$log = Join-Path $Artifact "online-entry-local-preview.log"
$err = Join-Path $Artifact "online-entry-local-preview.err.log"
$server = Start-Process -FilePath "node.exe" `
    -ArgumentList (Join-Path $project "backend\local-preview-server.mjs") `
    -WorkingDirectory $project -WindowStyle Hidden `
    -RedirectStandardOutput $log -RedirectStandardError $err -PassThru

try {
    $health = $null
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            $health = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2
            if ($health.StatusCode -eq 200) { break }
        } catch {
            Start-Sleep -Milliseconds 250
        }
    }
    if ($null -eq $health -or $health.StatusCode -ne 200) {
        throw "Local Web server did not become healthy. See $err"
    }

    $python = (Get-Command python -ErrorAction SilentlyContinue).Source
    if ([string]::IsNullOrWhiteSpace($python)) {
        $python = "C:\Users\KgccaAc\AppData\Local\Programs\Python\Python313\python.exe"
    }
    $arguments = @("-u", (Join-Path $project "tests\web\online_entry_flow.py"), "--url", "http://127.0.0.1:$Port/index.html", "--output", $Artifact, "--pages", "$Pages")
    if ($Headed) { $arguments += "--headed" }
    if ($CreateRoom) { $arguments += "--create-room" }
    & $python @arguments
    exit $LASTEXITCODE
}
finally {
    if ($server -and -not $server.HasExited) {
        Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
    }
}
