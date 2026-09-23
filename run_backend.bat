@echo off
chcp 65001 >nul
title WorkManagement Backend (.NET 10)
echo ===================================================
echo   KHOI CHAY BACKEND WORKMANAGEMENT (.NET 10)
echo ===================================================
echo Giai phong cong 8000 neu dang bi chiem dung...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

echo Dang khoi chay tren http://127.0.0.1:8000 ...
echo Nhan Ctrl+C de dung server.
echo.
cd /d "%~dp0backend"
dotnet run
pause
