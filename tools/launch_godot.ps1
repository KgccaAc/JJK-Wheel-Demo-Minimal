$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$godotPath = 'C:\Users\KgccaAc\Desktop\Godot_v4.6.2-stable_mono_win64\Godot_v4.6.2-stable_mono_win64\Godot_v4.6.2-stable_mono_win64.exe'
$godotUserData = Join-Path $projectRoot '.godot-user'

if (-not (Test-Path -LiteralPath $godotPath)) {
    throw "找不到 Godot .NET：$godotPath"
}

New-Item -ItemType Directory -Force -Path $godotUserData | Out-Null
$env:APPDATA = $godotUserData
$env:LOCALAPPDATA = $godotUserData
$env:DOTNET_CLI_HOME = $godotUserData
$env:NUGET_PACKAGES = Join-Path $godotUserData 'nuget-packages'

Write-Host '正在编译 C# 项目...'
& $godotPath --headless --path $projectRoot --build-solutions
$buildExitCode = $LASTEXITCODE
if ($null -ne $buildExitCode -and $buildExitCode -ne 0) {
    throw "C# 编译失败，退出码：$buildExitCode"
}

Write-Host 'C# 编译成功，正在打开 Godot 编辑器...'
& $godotPath --editor --path $projectRoot

