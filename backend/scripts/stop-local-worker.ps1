$backendRoot = Split-Path -Parent $PSScriptRoot
$pidPath = Join-Path (Join-Path $backendRoot '.runtime') 'local-worker.pid'
if (-not (Test-Path $pidPath)) {
  Write-Output 'LOCAL_WORKER_NOT_RUNNING'
  exit 0
}
$processId = (Get-Content -Raw $pidPath).Trim()
$process = Get-Process -Id $processId -ErrorAction SilentlyContinue
if ($process) { Stop-Process -Id $process.Id -Force }
Remove-Item -LiteralPath $pidPath -Force
Write-Output 'LOCAL_WORKER_STOPPED'

