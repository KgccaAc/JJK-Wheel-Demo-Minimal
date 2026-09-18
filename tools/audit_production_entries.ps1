param([switch]$Strict)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$run = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfffZ')
$outDir = Join-Path $root 'reports/production-entry'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$roots = @('app','gameplay','network','backend','scenes/auth','scenes/home','scenes/roster','scenes/battle','scenes/online','scenes/profile','project.godot')
$files = foreach($r in $roots){ $p=Join-Path $root $r; if(Test-Path $p){ if((Get-Item $p).PSIsContainer){ Get-ChildItem $p -Recurse -File -Include *.gd,*.tscn,*.mjs,*.js,*.json,*.godot } else { Get-Item $p } } }
$rules = @(
  @{ code='LEGACY_SCENE_PATH'; pattern='res://scenes/(fight|login|menu|User|onlineroom)/' },
  @{ code='V1_GATEWAY'; pattern='preview-worker-gateway|online-room-v1' },
  @{ code='DIRECT_CARD_RUNTIME'; pattern='normalize_direct_card|_compile_direct_card|source_kind\s*=\s*["'']direct_card["'']' },
  @{ code='LEGACY_RUNTIME_CALL'; pattern='V1Runtime|LegacyRuntime|legacy_runtime|direct_card' }
)
$findings = @()
foreach($f in $files){
  $text = Get-Content -Raw -LiteralPath $f.FullName
  foreach($rule in $rules){
    if($text -match $rule.pattern){
      $findings += [ordered]@{ code=$rule.code; file=$f.FullName.Substring($root.Length+1); pattern=$rule.pattern }
    }
  }
}
$result = [ordered]@{ schema='jjk-production-entry-audit-v1'; run_id=$run; scanned_roots=$roots; scanned_files=@($files).Count; violations=$findings.Count; findings=$findings }
$json = Join-Path $outDir "$run.json"; $md = Join-Path $outDir "$run.md"
$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $json -Encoding UTF8
@("# Production entry audit $run", "", "- Scanned files: $(@($files).Count)", "- Violations: $($findings.Count)", "") + @($findings | ForEach-Object { "- $($_.code): $($_.file)" }) | Set-Content -LiteralPath $md -Encoding UTF8
Write-Output "PRODUCTION_ENTRY_AUDIT scanned=$(@($files).Count) violations=$($findings.Count) report=$json"
if($Strict -and $findings.Count -gt 0){ exit 1 }
exit 0
