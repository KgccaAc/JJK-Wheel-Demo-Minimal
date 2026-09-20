param([string]$Root = (Split-Path -Parent $PSScriptRoot))
$forbidden = @('User', 'PreviewSummoned\d+', 'ContentScale', 'ModeCard\d+', 'CardContent', 'NewButton')
$results = @()
Get-ChildItem -LiteralPath (Join-Path $Root 'scenes') -Recurse -Filter '*.tscn' -File | ForEach-Object {
  $path = $_.FullName
  $lineNumber = 0
  Get-Content -LiteralPath $path | ForEach-Object {
    $lineNumber++
    foreach ($pattern in $forbidden) {
      if ($_ -match ('node name="' + $pattern + '"')) {
        $results += [ordered]@{ file = $path; line = $lineNumber; rule = 'forbidden_node_name'; pattern = $pattern; text = $_.Trim() }
      }
    }
  }
}
$reportDir = Join-Path $Root 'reports/structure'
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfffZ')
$jsonPath = Join-Path $reportDir "$stamp.json"
$results | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $jsonPath -Encoding UTF8
$md = @('# Scene Structure Audit', '', "Generated: $stamp", "Violations: $($results.Count)", '')
if ($results.Count -eq 0) { $md += 'No forbidden node names found.' }
else { $md += ($results | ForEach-Object { "- `$($_.file):$($_.line)` — $($_.pattern)" }) }
$md -join [Environment]::NewLine | Set-Content -LiteralPath (Join-Path $reportDir "$stamp.md") -Encoding UTF8
Write-Output "SCENE_STRUCTURE_AUDIT violations=$($results.Count) report=$jsonPath"
if ($results.Count -gt 0) { exit 2 }
exit 0

