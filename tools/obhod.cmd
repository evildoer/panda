@echo off
rem ASCII only: the menu and all Russian text live inside zapret-pick.ps1 (-Menu).
rem Nothing Russian is printed here: cmd reads .cmd in its own codepage and breaks on it.
cd /d "%~dp0"
if not exist "%~dp0zapret-pick.ps1" (
  echo File zapret-pick.ps1 not found next to this launcher.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0zapret-pick.ps1" -Menu
exit /b 0
