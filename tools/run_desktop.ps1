param([switch]$Editor)
$root = Split-Path -Parent $PSScriptRoot
$godot = $env:JJK_GODOT
if ([string]::IsNullOrWhiteSpace($godot)) { $godot = Join-Path $root '..\Godot_v4.6.2-stable_mono_win64\Godot_v4.6.2-stable_mono_win64\Godot_v4.6.2-stable_mono_win64.exe' }
if (-not (Test-Path $godot)) { throw "Godot executable not found; set JJK_GODOT" }
$args = @('--path', $root)
if ($Editor) { $args += '--editor' }
& $godot @args
exit $LASTEXITCODE
