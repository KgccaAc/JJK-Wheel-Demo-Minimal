param(
    [string]$Godot = $env:JJK_GODOT,
    [string]$LogPath = "reports/balance/technique-family-strength-run.log",
    [int]$CardLimit = 0
)

$root = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($Godot)) {
    $Godot = 'C:\Users\KgccaAc\Desktop\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe'
}
if (-not (Test-Path -LiteralPath $Godot)) { throw "Godot executable not found: $Godot" }
$log = Join-Path $root $LogPath
$logDir = Split-Path -Parent $log
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

Push-Location $root
try {
    & $Godot --headless --path . --script tests/godot/TechniqueAuditMeasurement.gd "--limit=$CardLimit" *>> $log
    if ($LASTEXITCODE -ne 0) { throw "TechniqueAuditMeasurement failed with exit code $LASTEXITCODE" }
    & node tools/score_technique_families.mjs *>> $log
    if ($LASTEXITCODE -ne 0) { throw "score_technique_families failed with exit code $LASTEXITCODE" }
    Add-Content -Path $log -Value "TECHNIQUE_FAMILY_STRENGTH_RUN PASS"
}
catch {
    Add-Content -Path $log -Value ("TECHNIQUE_FAMILY_STRENGTH_RUN FAIL " + $_.Exception.Message)
    exit 1
}
finally {
    Pop-Location
}
