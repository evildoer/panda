@echo off
rem ============================================================
rem  PANDAMIA BOT -- двойной клик = запуск бота (живой лог).
rem  С аргументами работает как node: `panda.cmd .` = бот,
rem  `panda.cmd --version` = версия (берётся совместимая).
rem  Боту нужен Node >= 22: если системный старый, берётся
rem  портативный из папки node-v*-win-x64 рядом с этим файлом.
rem  Окно держит cmd /K: Ctrl+C -> Y -- консоль остаётся для git.
rem ============================================================
if "%~1"=="APP" goto app
if not "%~1"=="" goto shim
rem -- без аргументов (двойной клик): бот в окне, окно не закроется:
cmd /K call "%~f0" APP
exit /b

:shim
rem -- режим шима: panda.cmd <аргументы> = node <аргументы>:
setlocal
set "NEXE="
for /f "delims=" %%E in ('dir /b /ad "%~dp0node-v*-win-x64" 2^>nul') do if exist "%~dp0%%E\node.exe" if not defined NEXE set "NEXE=%~dp0%%E\node.exe"
if not defined NEXE goto sysnode
"%NEXE%" %*
endlocal & exit /b %errorlevel%
:sysnode
node.exe %*
exit /b %errorlevel%

:app
title PANDAMIA BOT
pushd "%~dp0"
setlocal
set "NEXE="
for /f "delims=" %%E in ('dir /b /ad "%~dp0node-v*-win-x64" 2^>nul') do if exist "%~dp0%%E\node.exe" if not defined NEXE set "NEXE=%~dp0%%E\node.exe"
if not defined NEXE goto sysrun
echo [%DATE% %TIME%] --- PANDAMIA BOT: запуск ---
"%NEXE%" .
echo [%DATE% %TIME%] --- бот остановлен. panda.cmd = запустить снова, exit = закрыть окно ---
popd
exit /b
:sysrun
echo [%DATE% %TIME%] --- PANDAMIA BOT: запуск на системном node ---
node.exe .
echo [%DATE% %TIME%] --- бот остановлен. panda.cmd = запустить снова, exit = закрыть окно ---
popd
exit /b
