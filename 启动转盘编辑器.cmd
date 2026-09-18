@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\launch_godot.ps1"
if errorlevel 1 pause
