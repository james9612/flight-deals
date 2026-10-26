@echo off
chcp 65001 >nul
title [Flight Deals] Startup Auto-Run Settings

set "SCRIPT_DIR=%~dp0"
set "APP_DIR=%SCRIPT_DIR%outputs\flight-deals"
set "STARTUP_VBS=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\FlightDealsReceiver.vbs"

echo ========================================================
echo  Flight Deals - Windows Auto-Start Configurator
echo ========================================================
echo.
echo Please choose an option:
echo   [1] Enable Auto-Start on Windows Boot (Silent Background Mode)
echo   [2] Disable Auto-Start on Windows Boot
echo   [3] Exit
echo.
set /p opt="Enter number (1/2/3) and press Enter: "

if "%opt%"=="1" goto install
if "%opt%"=="2" goto uninstall
goto end

:install
(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo WshShell.CurrentDirectory = "%APP_DIR%"
echo WshShell.Run "node collectors/messenger-receiver.mjs", 0, False
) > "%STARTUP_VBS%"

echo.
echo [SUCCESS] Auto-start script installed successfully!
echo The receiver server will now start silently in the background whenever Windows boots.
echo.
pause
goto end

:uninstall
if exist "%STARTUP_VBS%" (
    del "%STARTUP_VBS%"
    echo.
    echo [SUCCESS] Auto-start script removed!
) else (
    echo.
    echo [INFO] Auto-start was not enabled.
)
echo.
pause
goto end

:end
