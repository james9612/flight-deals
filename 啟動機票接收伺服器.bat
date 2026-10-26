@echo off
chcp 65001 >nul
title [Flight Deals] Messenger Receiver Server

echo ========================================================
echo  Flight Deals - Messenger Live Ingestion Server
echo  Status: Starting...
echo ========================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "APP_DIR=%SCRIPT_DIR%outputs\flight-deals"

if not exist "%APP_DIR%\collectors\messenger-receiver.mjs" (
    echo [ERROR] Cannot find messenger-receiver.mjs!
    echo Checked path: %APP_DIR%\collectors\messenger-receiver.mjs
    echo Please make sure the folder structure is intact.
    echo.
    pause
    exit /b 1
)

cd /d "%APP_DIR%"

echo [INFO] Working Directory: %APP_DIR%
echo [INFO] Port: 3500
echo [INFO] Testing server...
echo.

node collectors/messenger-receiver.mjs

echo.
echo [INFO] Server stopped.
pause
