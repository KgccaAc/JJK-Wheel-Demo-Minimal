param(
  [Parameter(Mandatory=$true)][ValidateSet('start','stop','restart','health','logs','backup','migrate')][string]$Command
)
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$runtime = Join-Path $root '.runtime'
$pidPath = Join-Path $runtime 'worker.pid'
$node = (Get-Command node -ErrorAction Stop).Source
$worker = Join-Path $root 'backend/local-worker.mjs'
New-Item -ItemType Directory -Force $runtime | Out-Null
function Get-WorkerProcess {
  if (-not (Test-Path $pidPath)) { return $null }
  try { return Get-Process -Id ([int](Get-Content -Raw $pidPath)) -ErrorAction Stop } catch { Remove-Item $pidPath -Force -ErrorAction SilentlyContinue; return $null }
}
function Start-Worker {
  $existing = Get-WorkerProcess
  if ($existing) { Write-Output "worker already running pid=$($existing.Id)"; return }
  $log = Join-Path $runtime 'worker.stdout.log'; $errorLog = Join-Path $runtime 'worker.stderr.log'
  $process = Start-Process -FilePath $node -ArgumentList @($worker) -WorkingDirectory $root -RedirectStandardOutput $log -RedirectStandardError $errorLog -WindowStyle Hidden -PassThru
  $process.Id | Set-Content $pidPath -NoNewline
  Write-Output "worker started pid=$($process.Id)"
}
switch ($Command) {
  'start' { Start-Worker }
  'stop' { $p=Get-WorkerProcess; if ($p) { Stop-Process -Id $p.Id -Force; Remove-Item $pidPath -Force; Write-Output "worker stopped pid=$($p.Id)" } else { Write-Output 'worker not running' } }
  'restart' { & $PSCommandPath stop; & $PSCommandPath start }
  'health' { try { (Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:8787/health' -TimeoutSec 3).Content } catch { Write-Error 'worker health check failed'; exit 1 } }
  'logs' { Get-ChildItem $runtime -Filter '*.log' -ErrorAction SilentlyContinue | Select-Object FullName,Length,LastWriteTime }
  'backup' { $target=Join-Path $root ('backups/' + (Get-Date -Format 'yyyyMMddHHmmss') + '.zip'); New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null; Compress-Archive -Path (Join-Path $runtime '*') -DestinationPath $target -Force; Write-Output $target }
  'migrate' { Write-Output 'No database migration is required for the file-backed local worker.' }
}
