@echo off
rem ============================================================
rem  PANDAMIA BOT -- двойной клик = бот в живом окне.
rem  Окно держит cmd /K: Ctrl+C -> Y -- бот остановлен, а окно и
rem  консоль остаются (можно git push, снова panda.cmd или node .).
rem  Сам запуск делает node.cmd (совместимая версия Node).
rem ============================================================
if "%~1"=="APP" goto app
cmd /K call "%~f0" APP
exit /b
:app
title PANDAMIA BOT
pushd "%~dp0"
echo [%DATE% %TIME%] --- PANDAMIA BOT: запуск ^(останов: Ctrl+C затем Y; снова: node . или panda.cmd; выход из окна: exit^) ---
call "%~dp0node.cmd" .
echo [%DATE% %TIME%] --- бот остановлен. Снова: node . или panda.cmd ; закрыть окно: exit ---
popd
exit /b
