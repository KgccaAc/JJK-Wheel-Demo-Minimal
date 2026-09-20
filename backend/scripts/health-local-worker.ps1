param([int]$Port = 8787)
try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 3
  if (-not $health.ok -or $health.protocol_version -ne 'online-room-v1') { throw 'unexpected health response' }
  $health | ConvertTo-Json -Compress
  exit 0
} catch {
  Write-Error "LOCAL_WORKER_UNHEALTHY: $($_.Exception.Message)"
  exit 1
}

