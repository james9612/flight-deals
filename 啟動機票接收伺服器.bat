@echo off
title ✈️ 飛行便宜 - Messenger / FB 清艙機票接收伺服器
chcp 65001 >nul
cd /d "%~dp0outputs\flight-deals"

echo ========================================================
echo ✈️  正在啟動「飛行便宜」即時機票接收伺服器...
echo 📡 監聽位址：http://localhost:3500
echo 🟢 油猴外掛將自動連線並即時同步社群清艙機票！
echo.
echo 💡 提示：請保持此視窗開啟。縮小至工作列即可。
echo    若要停止接收，直接關閉此黑視窗即可。
echo ========================================================
echo.

node collectors/messenger-receiver.mjs
pause
