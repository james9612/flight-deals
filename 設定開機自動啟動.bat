@echo off
title ✈️ 設定開機自動背景啟動接收伺服器
chcp 65001 >nul

set "TARGET_DIR=%~dp0outputs\flight-deals"
set "STARTUP_VBS=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\FlightDealsReceiver.vbs"

echo ========================================================
echo ✈️  「飛行便宜」接收端 - 開機自動啟動設定
echo ========================================================
echo.
echo 請選擇要執行的操作：
echo   [1] 開啟開機自動啟動（每次開機後默默在背景常駐，不跳出視窗）
echo   [2] 關閉開機自動啟動（取消開機自動執行）
echo   [3] 退出
echo.
set /p opt="請輸入數字 (1/2/3) 後按 Enter: "

if "%opt%"=="1" goto install
if "%opt%"=="2" goto uninstall
goto end

:install
(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo WshShell.CurrentDirectory = "%TARGET_DIR%"
echo WshShell.Run "node collectors/messenger-receiver.mjs", 0, False
) > "%STARTUP_VBS%"

echo.
echo [成功] 已成功加入 Windows 開機啟動項目！
echo 以後電腦開機後，就會自動在背景啟動機票接收伺服器，油猴外掛永遠綠燈連線。
echo.
pause
goto end

:uninstall
if exist "%STARTUP_VBS%" (
    del "%STARTUP_VBS%"
    echo.
    echo [成功] 已移除開機自動啟動項目！
) else (
    echo.
    echo [提示] 尚未設定過開機自動啟動。
)
echo.
pause
goto end

:end
