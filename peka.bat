@echo off
rem ============================================================
rem  PEKA BOT -- запуск для всех (батник внутри папки бота)
rem  Никаких абсолютных путей: всё относительно этого файла.
rem  Node ищется сам: портативный рядом -> системный в PATH.
rem  Окно не закрывается после Ctrl+C -> Y (оболочка остаётся).
rem ============================================================
setlocal
if "%~1"=="K" goto run
cmd /K call "%~f0" K
exit /b

:run
title PEKA BOT
pushd "%~dp0"

rem -- конфиг есть? (без него боту нечего запускать)
if not exist "config.json" (
    echo [!] Нет файла config.json.
    echo     Скопируй config.example.json в config.json и впиши свой TOKEN.
    echo     Подробности -- в README.md, раздел "Настройка".
    popd
    goto :eof
)

rem -- поиск Node: сперва портативный рядом, затем системный:
set "NODE_EXE="
if exist "node-v24.21.0-win-x64\node.exe" set "NODE_EXE=node-v24.21.0-win-x64\node.exe"
if not defined NODE_EXE for %%D in ("node-v*-win-x64\node.exe") do set "NODE_EXE=%%~D"
if not defined NODE_EXE where node >nul 2>nul && set "NODE_EXE=node"
if not defined NODE_EXE (
    echo [!] Node.js не найден: ни портативный рядом с батником, ни в PATH.
    echo     Положи портативный Node в папку бота или поставь с nodejs.org
    popd
    goto :eof
)

rem -- зависимости на месте? при первом запуске ставим сами:
if not exist "node_modules\discord.js" (
    echo [i] Первый запуск: ставлю зависимости ^(npm install^)...
    call npm install
    if errorlevel 1 (
        echo [!] npm install не удался -- смотри ошибку выше.
        popd
        goto :eof
    )
)

echo [%DATE% %TIME%] --- PEKA BOT: запуск ^(останов: Ctrl+C, затем Y; снова: peka.bat; выход из окна: exit^) ---
%NODE_EXE% .
echo [%DATE% %TIME%] --- бот остановлен. Консоль осталась: peka.bat = запустить снова, exit = закрыть окно ---
popd
