$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$checks = @(
    @{ File = 'scenes/home/HomePage.gd'; Pattern = 'res://scenes/story/StroyHome.tscn'; Name = 'home story entry' },
    @{ File = 'scenes/home/HomePage.gd'; Pattern = '_add_story_demo_entry'; Name = 'legacy story demo removed'; Absent = $true },
    @{ File = 'scenes/wheel/IdentityFlow.gd'; Pattern = 'res://scenes/wheel/Select.tscn'; Name = 'identity to select' },
    @{ File = 'scenes/wheel/SelectFlow.gd'; Pattern = 'res://scenes/story/StroyHome.tscn'; Name = 'select to story home' },
    @{ File = 'scenes/wheel/SelectFlow.gd'; Pattern = 'res://scenes/wheel/wheel.tscn'; Name = 'select to wheel' },
    @{ File = 'scenes/story/StoryHomeFlow.gd'; Pattern = 'res://scenes/story/RPG.tscn'; Name = 'story home to rpg' },
    @{ File = 'scenes/story/RpgFlow.gd'; Pattern = 'res://scenes/story/selection.tscn'; Name = 'rpg to selection' },
    @{ File = 'scenes/story/SelectionFlow.gd'; Pattern = 'res://scenes/story/Map.tscn'; Name = 'selection to map' },
    @{ File = 'scenes/story/RpgFlow.gd'; Pattern = '初始背景'; Name = 'rpg background sequence' },
    @{ File = 'scenes/story/RpgFlow.gd'; Pattern = 'glass'; Name = 'glass sound' }
)
$failed = @()
foreach ($check in $checks) {
    $path = Join-Path $root $check.File
    $text = if (Test-Path $path) { Get-Content -Raw $path } else { '' }
    $ok = if ($check.Absent) { -not $text.Contains($check.Pattern) } else { $text.Contains($check.Pattern) }
    Write-Output ("[{0}] {1}" -f ($(if ($ok) {'PASS'} else {'FAIL'}), $check.Name))
    if (-not $ok) { $failed += $check.Name }
}
if ($failed.Count -gt 0) { exit 1 }
exit 0
