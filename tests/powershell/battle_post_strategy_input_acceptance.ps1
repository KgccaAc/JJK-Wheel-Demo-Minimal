$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$godot = 'C:\Users\KgccaAc\Desktop\Godot_v4.6.2-stable_mono_win64\Godot_v4.6.2-stable_mono_win64\Godot_v4.6.2-stable_mono_win64.exe'
$env:APPDATA = Join-Path $projectRoot '.godot-user'
$env:LOCALAPPDATA = $env:APPDATA
$env:DOTNET_CLI_HOME = $env:APPDATA
$env:NUGET_PACKAGES = Join-Path $env:APPDATA 'nuget-packages'
$output = & $godot --headless --path $projectRoot --script res://tests/godot/BattlePostStrategyInputAcceptance.gd --quit-after 4000 2>&1 | Out-String
Write-Output $output
if ($output -notmatch 'BATTLE_POST_STRATEGY_INPUT_PASS' -or $output -match 'SCRIPT ERROR:|Parse Error:') { exit 1 }
exit 0
