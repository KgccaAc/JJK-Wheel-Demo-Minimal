$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$godot = 'C:\Users\KgccaAc\Desktop\Godot_v4.6.2-stable_mono_win64\Godot_v4.6.2-stable_mono_win64\Godot_v4.6.2-stable_mono_win64.exe'
$output = & $godot --headless --path $projectRoot --script res://tests/godot/WheelAutoRankAcceptance.gd --quit-after 5000 2>&1 | Out-String
Write-Output $output
if ($output -notmatch 'WHEEL_AUTO_RANK_ACCEPTANCE_PASS' -or $output -match 'SCRIPT ERROR:|Parse Error:') { exit 1 }
exit 0
