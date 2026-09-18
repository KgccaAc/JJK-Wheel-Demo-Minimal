param([switch]$Fast)
$root = Split-Path -Parent $PSScriptRoot
$ErrorActionPreference = 'Continue'
$results = @()
function Invoke-Step([string]$Name, [scriptblock]$Action) {
  Write-Output "TEST_START test=$Name"
  $global:LASTEXITCODE = 0
  try {
    $stepOutput = @(& $Action 2>&1)
    $stepOutput | ForEach-Object { Write-Output $_ }
  } catch {
    Write-Output $_
    $global:LASTEXITCODE = 1
  }
  $code = if ($null -eq $LASTEXITCODE) { 1 } else { [int]$LASTEXITCODE }
  $status = if ($code -eq 0) { 'PASS' } else { 'FAIL' }
  $script:results += [ordered]@{ test=$Name; status=$status; exitCode=$code }
  Write-Output "TEST_$status test=$Name"
}
Push-Location $root
try {
  Invoke-Step 'godot_editor_scan' {
    $godot = $env:JJK_GODOT
    if ([string]::IsNullOrWhiteSpace($godot)) {
      $godot = Join-Path $root '..\Godot_v4.6.2-stable_mono_win64\Godot_v4.6.2-stable_mono_win64\Godot_v4.6.2-stable_mono_win64.exe'
    }
    if (-not (Test-Path -LiteralPath $godot)) { throw "Godot executable not found: $godot" }
    & $godot --headless --path . --editor --quit
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
  Invoke-Step 'scene_structure_audit' { powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/audit_scene_structure.ps1 }
  Invoke-Step 'uid_ownership' { powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/powershell/uid_ownership_acceptance.ps1 }
  Invoke-Step 'production_entry_audit' { powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/audit_production_entries.ps1 -Strict }
  Invoke-Step 'target_structure' { powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/powershell/refactor_target_structure_acceptance.ps1 }
  Get-ChildItem tests/backend -Filter '*.mjs' | ForEach-Object { $test=$_.Name; Invoke-Step "backend_$test" { node (Join-Path 'tests/backend' $test) } }
  if (-not $Fast) {
    Invoke-Step 'online_battle_v3_flow' { powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/powershell/online_battle_v3_flow_acceptance.ps1 }
  }
} finally { Pop-Location }
$failed = @($results | Where-Object status -eq 'FAIL').Count
$report = [ordered]@{ schema='jjk-full-acceptance-v1'; timestamp=(Get-Date).ToUniversalTime().ToString('o'); results=$results; failed=$failed; status=if($failed -eq 0){'PASS'}else{'FAIL'} }
New-Item -ItemType Directory -Force (Join-Path $root 'reports') | Out-Null
$report | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $root 'reports/acceptance-latest.json') -Encoding UTF8
@("# Full acceptance", "", "- Status: $($report.status)", "- Failed: $failed", "- Timestamp: $($report.timestamp)") | Set-Content (Join-Path $root 'reports/acceptance-latest.md') -Encoding UTF8
Write-Output "TEST_END status=$($report.status) failed=$failed"
if ($failed -gt 0) { exit 1 }
