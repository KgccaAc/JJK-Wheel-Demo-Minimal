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
# Runs an external acceptance script only if it still exists.
# A missing script is reported as SKIP with a loud warning rather than being
# silently dropped -- an unnoticed skip is worse than a visible gap. SKIP does
# not fail the run, so the suite stays usable while the gap is unresolved.
function Invoke-ScriptStep([string]$Name, [string]$ScriptPath, [string[]]$ExtraArgs = @()) {
  $full = Join-Path $root $ScriptPath
  if (-not (Test-Path -LiteralPath $full)) {
    Write-Warning "SKIPPED '$Name': script not found at $ScriptPath"
    $script:results += [ordered]@{ test=$Name; status='SKIP'; exitCode=$null; reason="missing:$ScriptPath" }
    Write-Output "TEST_SKIP test=$Name reason=missing_script path=$ScriptPath"
    return
  }
  Invoke-Step $Name { & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $full @ExtraArgs }
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
  Invoke-ScriptStep 'scene_structure_audit' 'tools/audit_scene_structure.ps1'
  Invoke-ScriptStep 'uid_ownership' 'tests/powershell/uid_ownership_acceptance.ps1'
  Invoke-ScriptStep 'production_entry_audit' 'tools/audit_production_entries.ps1' @('-Strict')
  Invoke-ScriptStep 'target_structure' 'tests/powershell/refactor_target_structure_acceptance.ps1'
  Get-ChildItem tests/backend -Filter '*.mjs' | ForEach-Object { $test=$_.Name; Invoke-Step "backend_$test" { node (Join-Path 'tests/backend' $test) } }
  if (-not $Fast) {
    Invoke-ScriptStep 'online_battle_v3_flow' 'tests/powershell/online_battle_v3_flow_acceptance.ps1'
  }
} finally { Pop-Location }
$failed = @($results | Where-Object status -eq 'FAIL').Count
$skipped = @($results | Where-Object status -eq 'SKIP')
$report = [ordered]@{ schema='jjk-full-acceptance-v1'; timestamp=(Get-Date).ToUniversalTime().ToString('o'); results=$results; failed=$failed; skipped=$skipped.Count; status=if($failed -eq 0){'PASS'}else{'FAIL'} }
New-Item -ItemType Directory -Force (Join-Path $root 'reports') | Out-Null
$report | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $root 'reports/acceptance-latest.json') -Encoding UTF8
$md = @("# Full acceptance", "", "- Status: $($report.status)", "- Failed: $failed", "- Skipped: $($skipped.Count)", "- Timestamp: $($report.timestamp)", "")
if ($skipped.Count -gt 0) {
  $md += @('## Skipped steps', '')
  $md += ($skipped | ForEach-Object { "- `$($_.test)` -- missing script: `$($_.reason)" })
}
$md | Set-Content (Join-Path $root 'reports/acceptance-latest.md') -Encoding UTF8
if ($skipped.Count -gt 0) { Write-Warning "$($skipped.Count) acceptance step(s) skipped due to missing scripts; see reports/acceptance-latest.md" }
Write-Output "TEST_END status=$($report.status) failed=$failed skipped=$($skipped.Count)"
if ($failed -gt 0) { exit 1 }

