@echo off
chcp 65001 >nul
title Khoi Chay He Thong WorkManagement
echo ===================================================
echo   KHOI CHAY WORKMANAGEMENT (BACKEND + FRONTEND)
echo ===================================================

echo Giai phong cong 8000 neu dang bi chiem dung...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

echo 1. Dang mo cua so chay Backend (.NET 10 tai http://127.0.0.1:8000)...
start "WorkManagement Backend (.NET 10)" cmd /k "cd /d "%~dp0backend" && dotnet run"

timeout /t 3 /nobreak >nul

echo 2. Dang mo cua so chay Frontend (Vite React)...
start "WorkManagement Frontend (Vite React)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ===================================================
echo   He thong da duoc khoi chay thanh cong!
echo   - Backend:  http://127.0.0.1:8000
echo   - Frontend: Xem duong dan trong cua so Frontend
echo               (thuong la http://localhost:5173)
echo ===================================================
pause
