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
rem ============================================================
if /i "%~1"=="APP" goto app
if "%~1"=="" (cmd /K call "%~f0" APP & exit /b)
setlocal
set "NEXE="
for /f "delims=" %%E in ('dir /b /ad "%~dp0node-v*-win-x64" 2^>nul') do if exist "%~dp0%%E\node.exe" if not defined NEXE set "NEXE=%~dp0%%E\node.exe"
if not defined NEXE set "NEXE=node.exe"
"%NEXE%" %*
endlocal & exit /b %errorlevel%

:app
title PANDAMIA BOT
pushd "%~dp0"
echo [%DATE% %TIME%] --- бот запущен. Остановить: Ctrl+C, затем Y. Снова: node . ---
call "%~dp0node.cmd" .
echo [%DATE% %TIME%] --- бот остановлен. Снова: node . ; закрыть окно: exit ---
popd
exit /b
