param(
    [switch]$SkipBattle,
    [switch]$SkipRealWindow
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$reportRoot = Join-Path $projectRoot 'reports'
$selfRoot = Join-Path $reportRoot 'self-improve'
$flowRoot = Join-Path $reportRoot 'full-flow'
$uiAuditRoot = Join-Path $reportRoot 'ui-audit'
New-Item -ItemType Directory -Force -Path $selfRoot, $flowRoot, $uiAuditRoot | Out-Null

$results = @()
$godot = $env:JJK_GODOT
if ([string]::IsNullOrWhiteSpace($godot)) {
    $godot = 'C:\Users\KgccaAc\Desktop\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe'
}
$runner = Join-Path $projectRoot 'tools\run_battle_acceptance.ps1'
if (-not $SkipBattle -and (Test-Path -LiteralPath $runner)) {
    $runnerOutput = @(& $runner 2>&1 | ForEach-Object { $_.ToString() })
    $runnerOutput | Set-Content -LiteralPath (Join-Path $reportRoot 'self-improve-runner-latest.txt')
    foreach ($line in $runnerOutput) {
        if ($line -match '^BATTLE_ACCEPTANCE_RESULT status=(PASS|FAIL) script=(.+?)(?: exit_code=(\d+))?$') {
            $results += [ordered]@{
                script = $Matches[2]
                status = $Matches[1]
                exit_code = if ($Matches[3]) { [int]$Matches[3] } else { 0 }
            }
        }
    }
}

$buttonAuditScript = Join-Path $projectRoot 'tests\godot\PageButtonWiringAudit.gd'
if ((Test-Path -LiteralPath $godot) -and (Test-Path -LiteralPath $buttonAuditScript)) {
    $previousErrorPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $buttonAuditOutput = @(& $godot --headless --path $projectRoot --script $buttonAuditScript 2>&1 | ForEach-Object { $_.ToString() })
    $buttonAuditExit = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorPreference
    $buttonAuditOutput | Set-Content -LiteralPath (Join-Path $uiAuditRoot 'page-button-wiring-latest.log') -Encoding UTF8
    $results += [ordered]@{
        script = $buttonAuditScript
        status = if ($buttonAuditExit -eq 0) { 'PASS' } else { 'FAIL' }
        exit_code = $buttonAuditExit
    }
}

$flow = [ordered]@{
    schema = 'godot-full-flow-v1'
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
    status = 'skipped'
    reason = 'real-window flow was explicitly skipped'
    screenshots = @()
}
if (-not $SkipRealWindow) {
    $flowScript = Join-Path $projectRoot 'tests\godot\StoryRealWindowFlowAcceptance.gd'
    $flowLog = Join-Path $flowRoot 'real-window-flow-latest.log'
    if ((Test-Path -LiteralPath $godot) -and (Test-Path -LiteralPath $flowScript)) {
        $previousErrorPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        $flowOutput = @(& $godot --path $projectRoot --script $flowScript 2>&1 | ForEach-Object { $_.ToString() })
        $flowExit = $LASTEXITCODE
        $ErrorActionPreference = $previousErrorPreference
        $flowOutput | Set-Content -LiteralPath $flowLog -Encoding UTF8
        $generatedFlowPath = Join-Path $flowRoot 'full-flow-latest.json'
        if (Test-Path -LiteralPath $generatedFlowPath) {
            $flow = Get-Content -LiteralPath $generatedFlowPath -Raw -Encoding UTF8 | ConvertFrom-Json
        }
        if ($flowExit -ne 0 -or $flow.status -ne 'passed') {
            $flow.status = 'failed'
            $flow.reason = "runner exit code $flowExit"
        }
        $results += [ordered]@{
            script = $flowScript
            status = if ($flow.status -eq 'passed') { 'PASS' } else { 'FAIL' }
            exit_code = $flowExit
        }
    } else {
        $flow.status = 'failed'
        $flow.reason = 'Godot executable or real-window runner missing'
        $results += [ordered]@{ script = $flowScript; status = 'FAIL'; exit_code = 127 }
    }
}
$flow | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $flowRoot 'full-flow-latest.json') -Encoding UTF8

$passed = @($results | Where-Object { $_.status -eq 'PASS' }).Count
$failed = @($results | Where-Object { $_.status -eq 'FAIL' }).Count
$total = $results.Count
$acceptance = [ordered]@{
    schema = 'godot-acceptance-v1'
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
    total = $total
    passed = $passed
    failed = $failed
    results = $results
}
$acceptance | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $reportRoot 'acceptance-latest.json') -Encoding UTF8

$p1 = if ($failed -gt 0) { 1 } else { 0 }
$followUps = @(
    'P2: migrate FightPresenter to BattleRulesV1Session read-only projection',
    'P2: extend CoreActionResolver DSL execution coverage with state assertions',
    'P2: repair the remaining invalid UID metadata in battle scene resources',
    'P2: add field-by-field source fixture state_hash comparison',
    'P2: add 720p, 1080p, and tall-window screenshot layout coverage',
    'P2: add an exported Web build journey covering CORS and scene navigation'
)
$selfReport = [ordered]@{
    schema = 'godot-self-improve-v1'
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
    acceptance = [ordered]@{ total = $total; passed = $passed; failed = $failed }
    full_flow = [ordered]@{ status = $flow.status }
    priorities = [ordered]@{ P0 = 0; P1 = $p1; P2 = $followUps.Count }
    follow_ups = $followUps
}
$selfReport | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $selfRoot 'self-improve-latest.json') -Encoding UTF8

$markdown = @(
    '# Godot Self-Improve Report',
    '',
    "Generated: $($selfReport.generated_at)",
    "Acceptance: total=$total passed=$passed failed=$failed",
    "Full flow: $($flow.status) ($($flow.reason))",
    '',
    '## Follow-ups',
    ''
) + ($followUps | ForEach-Object { "- $_" })
$markdown -join [Environment]::NewLine | Set-Content -LiteralPath (Join-Path $selfRoot 'self-improve-latest.md') -Encoding UTF8

if ($failed -gt 0) { exit 1 }
exit 0

