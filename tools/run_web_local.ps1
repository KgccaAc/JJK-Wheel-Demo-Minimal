param([int]$Port = 8088)
$root = Split-Path -Parent $PSScriptRoot
$env:LOCAL_PREVIEW_PORT = "$Port"
node (Join-Path $root 'backend/local-preview-server.mjs')
exit $LASTEXITCODE
