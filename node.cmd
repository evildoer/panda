@echo off
rem ============================================================
rem  Шим: в папке бота команда `node` -- это совместимая версия.
rem  Боту нужен Node >= 22, а системный бывает старый (16 и т.п.).
rem  cmd ищет исполняемые файлы сперва в ТЕКУЩЕЙ папке, поэтому
rem  привычное `node .` здесь запускает бота на правильном Node.
rem  Если портативного рядом нет -- работает обычный системный node.
rem ============================================================
setlocal
set "NEXE="
for /f "delims=" %%E in ('dir /b /ad "%~dp0node-v*-win-x64" 2^>nul') do if exist "%~dp0%%E\node.exe" if not defined NEXE set "NEXE=%~dp0%%E\node.exe"
if not defined NEXE goto sysnode
"%NEXE%" %*
endlocal & exit /b %errorlevel%
:sysnode
node.exe %*
