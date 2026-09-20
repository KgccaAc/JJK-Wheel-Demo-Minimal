param(
    [string[]]$Scripts = @()
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$errorRoot = Join-Path $projectRoot 'reports\errors'
New-Item -ItemType Directory -Force -Path $errorRoot | Out-Null
$runId = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfffZ')
$runLog = Join-Path $errorRoot "$runId.jsonl"
$bundleRoot = Join-Path $projectRoot 'reports\bundles'
New-Item -ItemType Directory -Force -Path $bundleRoot | Out-Null
if ($Scripts.Count -eq 0) {
    $Scripts = Get-ChildItem -LiteralPath (Join-Path $projectRoot 'tests\powershell') -Filter 'battle_*_acceptance.ps1' -File |
        Where-Object { $_.Name -ne 'battle_acceptance_runner_acceptance.ps1' } |
        Sort-Object Name |
        Select-Object -ExpandProperty FullName
}

$passed = 0
$failed = 0
foreach ($scriptPath in $Scripts) {
    $resolvedPath = [System.IO.Path]::GetFullPath($scriptPath)
    Write-Output "TEST_START test=$([System.IO.Path]::GetFileName($resolvedPath))"
    if (-not (Test-Path -LiteralPath $resolvedPath)) {
        Write-Output "BATTLE_ACCEPTANCE_RESULT status=FAIL script=$resolvedPath reason=missing_script"
        $failed++
        continue
    }
    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = 'pwsh.exe'
    $psi.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $resolvedPath + '"'
    $psi.WorkingDirectory = $projectRoot
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $child = [System.Diagnostics.Process]::new()
    $child.StartInfo = $psi
    [void]$child.Start()
    $stdoutPath = Join-Path $errorRoot "$runId.$([System.IO.Path]::GetFileNameWithoutExtension($resolvedPath)).stdout.log"
    $stderrPath = Join-Path $errorRoot "$runId.$([System.IO.Path]::GetFileNameWithoutExtension($resolvedPath)).stderr.log"
    if (-not $child.WaitForExit(120000)) {
        $child.Kill()
        $childExitCode = 124
        'TEST_ERROR timeout' | Set-Content -LiteralPath $stderrPath -Encoding UTF8
        "" | Set-Content -LiteralPath $stdoutPath -Encoding UTF8
        Write-Output ("BATTLE_ACCEPTANCE_RESULT status=FAIL script=$resolvedPath reason=timeout")
        $failed++
        continue
    }
    $stdout = $child.StandardOutput.ReadToEnd()
    $stderr = $child.StandardError.ReadToEnd()
    $stdout | Set-Content -LiteralPath $stdoutPath -Encoding UTF8
    $stderr | Set-Content -LiteralPath $stderrPath -Encoding UTF8
    $childOutput = $stdout + $stderr
    $childExitCode = $child.ExitCode
    $category = if ($childOutput -match 'NETWORK|HTTP|TIMEOUT') { 'NETWORK' } elseif ($childOutput -match 'SCENE|TSCN|Godot') { 'SCENE' } elseif ($childOutput -match 'BATTLE|REVISION|CARD') { 'BATTLE' } elseif ($childExitCode -eq 0) { 'UNKNOWN' } else { 'TEST' }
    $errorCode = if ($childExitCode -eq 0) { '' } elseif ($childOutput -match '(INVALID_[A-Z_]+|[A-Z]+_[A-Z_]+)') { $Matches[1] } else { 'TEST_FAILED' }
    $entry = [ordered]@{
        run_id = $runId
        test = [System.IO.Path]::GetFileName($resolvedPath)
        script = $resolvedPath
        exit_code = $childExitCode
        status = if ($childExitCode -eq 0) { 'PASS' } else { 'FAIL' }
        category = $category
        error_code = $errorCode
        stdout_path = $stdoutPath
        stderr_path = $stderrPath
        diagnostic_bundle = (Join-Path $bundleRoot "$runId.zip")
        errorCode = $errorCode
        exitCode = $childExitCode
        stdoutPath = $stdoutPath
        stderrPath = $stderrPath
        diagnosticBundle = (Join-Path $bundleRoot "$runId.zip")
        output = $childOutput
    }
    ($entry | ConvertTo-Json -Compress -Depth 8) | Add-Content -LiteralPath $runLog -Encoding UTF8
    if (-not [string]::IsNullOrWhiteSpace($childOutput)) { Write-Output $childOutput }
    if ($childExitCode -eq 0) {
        Write-Output "TEST_PASS test=$([System.IO.Path]::GetFileName($resolvedPath))"
        Write-Output "BATTLE_ACCEPTANCE_RESULT status=PASS script=$resolvedPath"
        $passed++
    } else {
        Write-Output "TEST_FAIL test=$([System.IO.Path]::GetFileName($resolvedPath)) category=$category errorCode=$errorCode"
        Write-Output "BATTLE_ACCEPTANCE_RESULT status=FAIL script=$resolvedPath exit_code=$childExitCode"
        $failed++
    }
}

Write-Output "TEST_END run_id=$runId"
Write-Output "BATTLE_ACCEPTANCE_SUMMARY total=$($Scripts.Count) passed=$passed failed=$failed"
$summary = [ordered]@{ schema = 'jjk-acceptance-errors-v1'; run_id = $runId; total = $Scripts.Count; passed = $passed; failed = $failed; log = $runLog }
$summaryPath = Join-Path $errorRoot "$runId.summary.json"
$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $summaryPath -Encoding UTF8
$bundlePath = Join-Path $bundleRoot "$runId.zip"
$bundleFiles = @(Get-ChildItem -LiteralPath $errorRoot -Filter "$runId.*.log" -File) + @(Get-Item -LiteralPath $runLog, $summaryPath)
if ($bundleFiles.Count -gt 0) { Compress-Archive -Path ($bundleFiles | Select-Object -ExpandProperty FullName) -DestinationPath $bundlePath -Force }
$summary.diagnostic_bundle = $bundlePath
$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $projectRoot 'reports\acceptance-latest.json') -Encoding UTF8
@("# Acceptance $runId", "", "- Total: $($Scripts.Count)", "- Passed: $passed", "- Failed: $failed", "- Errors: $runLog", "- Bundle: $bundlePath") | Set-Content -LiteralPath (Join-Path $projectRoot 'reports\acceptance-latest.md') -Encoding UTF8
if ($failed -gt 0) { exit 1 }
exit 0

