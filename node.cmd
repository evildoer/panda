@echo off
rem ============================================================
rem  node.cmd -- шим: В ЭТОЙ ПАПКЕ команда `node` = совместимая
rem  версия Node (боту нужен >= 22, а системный бывает старее).
rem  cmd ищет команды сперва в текущей папке, поэтому привычное
rem  `node .` здесь запускает бота на правильном Node.
rem    node .             -> бот (совместимый Node)
rem    node script.js ... -> как обычный node
rem    node --version     -> версия совместимого Node
rem  Если портативного рядом нет -- работает системный node.
rem ============================================================
setlocal
set "NEXE="
for /f "delims=" %%E in ('dir /b /ad "%~dp0node-v*-win-x64" 2^>nul') do if exist "%~dp0%%E\node.exe" if not defined NEXE set "NEXE=%~dp0%%E\node.exe"
if not defined NEXE set "NEXE=node.exe"
if "%~1"=="" goto bot
"%NEXE%" %*
endlocal & exit /b %errorlevel%
:bot
"%NEXE%" .
endlocal & exit /b %errorlevel%
