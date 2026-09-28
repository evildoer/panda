@echo off
rem ============================================================
rem  PANDAMIA BOT -- один файл на всё: и лаунчер, и шим Node.
rem
rem  Двойной клик (без аргументов) -- запуск бота, окно живое:
rem  Ctrl+C, затем Y -- бот остановлен, консоль осталась, можно
rem  делать git push и снова запускать: node . (или node.cmd).
rem  Закрыть окно -- команда exit.
rem
rem  node .                    -- то же самое из консоли.
rem  node script.js аргументы  -- обычный запуск скрипта.
rem
rem  В этой папке `node` -- совместимая версия из папки (боту
rem  нужен Node >= 22, а системный бывает старым; native-модули
rem  в node_modules собраны именно под неё). Вне этой папки
rem  работает обычный системный node.
rem
rem  Окно переводится в UTF-8 (chcp 65001): без этого русский
rem  текст бота в консоли выводится мусором.
rem
rem  Текст комментариев -- по-русски в OEM-кодировке (CP866),
rem  а рабочие строки -- только ASCII: cmd под UTF-8 спотыкается
rem  на не-ASCII в командах (проверено на этой самой правке).
rem ============================================================
if /i "%~1"=="APP" goto app
if "%~1"=="" (cmd /K call "%~f0" APP & exit /b)
setlocal
chcp 65001 >nul 2>&1
set "NDIR="
set "NEXE="
for /f "delims=" %%E in ('dir /b /ad "%~dp0node-v*-win-x64" 2^>nul') do if exist "%~dp0%%E\node.exe" if not defined NDIR set "NDIR=%~dp0%%E"
if defined NDIR set "NEXE=%NDIR%\node.exe"
if not defined NEXE set "NEXE=node.exe"
if defined NDIR set "PATH=%NDIR%;%PATH%"
"%NEXE%" %*
endlocal & exit /b %errorlevel%

:app
chcp 65001 >nul 2>&1
set "NDIR="
for /f "delims=" %%E in ('dir /b /ad "%~dp0node-v*-win-x64" 2^>nul') do if exist "%~dp0%%E\node.exe" if not defined NDIR set "NDIR=%~dp0%%E"
if defined NDIR set "PATH=%NDIR%;%PATH%"
if defined NDIR (echo [node] bundled Node: %NDIR%) else (echo [node] bundled Node not found -- using system node)
title PANDAMIA BOT
pushd "%~dp0"
echo [%DATE% %TIME%] --- BOT STARTED. Stop: Ctrl+C, then Y. Start again: node . ---
call "%~dp0node.cmd" .
echo [%DATE% %TIME%] --- BOT STOPPED. Start again: node . ; close window: exit ---
popd
exit /b
