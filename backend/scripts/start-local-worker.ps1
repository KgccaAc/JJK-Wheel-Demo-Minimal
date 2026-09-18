param([int]$Port = 8787)

$backendRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $backendRoot '.runtime'
$pidPath = Join-Path $runtimeDir 'local-worker.pid'
$stdoutPath = Join-Path $runtimeDir 'local-worker.stdout.log'
$stderrPath = Join-Path $runtimeDir 'local-worker.stderr.log'
$healthUrl = "http://127.0.0.1:$Port/health"

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
try {
  $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
  $requiredCapabilities = @('getBattleSnapshot', 'turnCommit', 'turnRevealAck', 'turnResolveReceipt')
  $capabilitiesReady = $health.capabilities -and @($requiredCapabilities | Where-Object { @($health.capabilities) -contains $_ }).Count -eq $requiredCapabilities.Count
  if ($health.ok -and $health.protocol_version -eq 'online-room-v1' -and $capabilitiesReady) {
    Write-Output "LOCAL_WORKER_ALREADY_RUNNING $healthUrl"
    exit 0
  }
} catch { }

if (Test-Path $pidPath) {
  $oldPid = Get-Content -Raw $pidPath
  $oldProcess = Get-Process -Id $oldPid.Trim() -ErrorAction SilentlyContinue
  if ($oldProcess) { Stop-Process -Id $oldProcess.Id -Force }
  Remove-Item -LiteralPath $pidPath -Force
}

# A previous launcher may have left a stale pid file. If the configured port
# is still occupied, terminate only that exact listener before starting the
# requested local Worker; otherwise the health probe can keep accepting an old
# binary that lacks newer capabilities.
$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener -and $listener.OwningProcess) {
  Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 100
}

$node = (Get-Command node -ErrorAction Stop).Source
$previousHost = $env:LOCAL_WORKER_HOST
$previousPort = $env:LOCAL_WORKER_PORT
$previousData = $env:LOCAL_WORKER_DATA_DIR
$env:LOCAL_WORKER_HOST = '127.0.0.1'
$env:LOCAL_WORKER_PORT = "$Port"
$env:LOCAL_WORKER_DATA_DIR = $runtimeDir
$process = Start-Process -FilePath $node -ArgumentList (Join-Path $backendRoot 'local-worker.mjs') -WorkingDirectory (Split-Path -Parent $backendRoot) -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru -WindowStyle Hidden
$env:LOCAL_WORKER_HOST = $previousHost
$env:LOCAL_WORKER_PORT = $previousPort
$env:LOCAL_WORKER_DATA_DIR = $previousData
$process.Id | Set-Content -NoNewline -Encoding ascii $pidPath

for ($attempt = 0; $attempt -lt 20; $attempt++) {
  Start-Sleep -Milliseconds 150
  try {
    $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
    $capabilitiesReady = $health.capabilities -and @($requiredCapabilities | Where-Object { @($health.capabilities) -contains $_ }).Count -eq $requiredCapabilities.Count
    if ($health.ok -and $health.protocol_version -eq 'online-room-v1' -and $capabilitiesReady) {
      Write-Output "LOCAL_WORKER_STARTED $healthUrl"
      exit 0
    }
  } catch { }
}

$errorText = if (Test-Path $stderrPath) { Get-Content -Raw $stderrPath } else { 'no worker error output' }
throw "Local Worker did not start. $errorText"

