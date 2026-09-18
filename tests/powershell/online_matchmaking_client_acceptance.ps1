$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$godot = 'C:\Users\KgccaAc\Desktop\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe'
$port = 18890
$dataDir = Join-Path ([System.IO.Path]::GetTempPath()) ("jjk-online-matchmaking-" + [Guid]::NewGuid().ToString('N'))
$server = $null
$previousPort = $env:PREVIEW_ROOM_PORT
$previousDataDir = $env:PREVIEW_ROOM_DATA_DIR

try {
    $env:PREVIEW_ROOM_PORT = "$port"
    $env:PREVIEW_ROOM_DATA_DIR = $dataDir
    $server = Start-Process -FilePath 'node.exe' -ArgumentList 'backend/preview-room-server.mjs' -WorkingDirectory $project -WindowStyle Hidden -PassThru
    $deadline = [DateTime]::UtcNow.AddSeconds(8)
    do {
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/health" -TimeoutSec 1
            if ($health.ok) { break }
        } catch { Start-Sleep -Milliseconds 50 }
    } while ([DateTime]::UtcNow -lt $deadline)
    if (-not $health.ok) { throw 'local preview-room authority did not become healthy' }

    $env:ONLINE_MATCHMAKING_ENDPOINT = "http://127.0.0.1:$port"
    & $godot --headless --path $project --script res://tests/godot/OnlineMatchmakingClientAcceptance.gd
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    Remove-Item Env:ONLINE_MATCHMAKING_ENDPOINT -ErrorAction SilentlyContinue
    if ($null -eq $previousPort) { Remove-Item Env:PREVIEW_ROOM_PORT -ErrorAction SilentlyContinue } else { $env:PREVIEW_ROOM_PORT = $previousPort }
    if ($null -eq $previousDataDir) { Remove-Item Env:PREVIEW_ROOM_DATA_DIR -ErrorAction SilentlyContinue } else { $env:PREVIEW_ROOM_DATA_DIR = $previousDataDir }
    if ($null -ne $server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force; $server.WaitForExit() }
    Remove-Item -LiteralPath $dataDir -Recurse -Force -ErrorAction SilentlyContinue
}
