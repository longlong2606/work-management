@echo off
chcp 65001 >nul
color 0b
title WorkShiftPro - Khoi Chay He Thong (May Tinh + Smart TV)
cls
echo =====================================================================
echo          HE THONG WORKSHIFTPRO - UNIFIED DUAL INTERFACE
echo =====================================================================
echo.

echo [1/4] Dang lay dia chi IP mang Wi-Fi/LAN...
set LOCAL_IP=127.0.0.1
for /f %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -InterfaceAlias 'Wi-Fi' -AddressFamily IPv4 -ErrorAction SilentlyContinue).IPAddress"') do (
    if not "%%i"=="" set LOCAL_IP=%%i
)
echo       -^> Dia chi IP mang hien tai: %LOCAL_IP%
echo.

echo [2/4] Dang giai phong cac cong 8000, 5173 neu dang bi chiem giu...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
echo       -^> Cac cong mang da san sang!
echo.

echo [3/4] Dang khoi chay Backend API (.NET 10 tren cong 8000)...
start "1. Backend API (:8000)" cmd /k "cd /d %~dp0backend && dotnet run"
timeout /t 3 /nobreak >nul

echo [4/4] Dang khoi chay Web App Tong Hop (tren cong 5173)...
start "2. Web App Unified (:5173)" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 3 /nobreak >nul

echo.
echo =====================================================================
echo                   KHOI CHAY HOAN TAT 100%%!
echo =====================================================================
echo.
echo  * Web Quan Ly May Tinh (PC):  http://localhost:5173/schedule
echo  * Man Hinh Kiosk Smart TV:    http://localhost:5173
echo.
echo  >>> DIA CHI MO TREN SMART TV (CHUNG WI-FI/LAN):
echo      http://%LOCAL_IP%:5173
echo.
echo =====================================================================
echo.
echo Dang mo trinh duyet ca 2 giao dien tren may tinh...
start http://localhost:5173/schedule
start http://localhost:5173
echo.
echo [Huong dan Smart TV]
echo - Tren trinh duyet TV 50 inch, truy cap: http://%LOCAL_IP%:5173
echo - Nhan F11 tren ban phim TV de xem toan man hinh Kiosk.
echo.
echo Nhan phim bat ky de DONG TAT CA cac server va thoat...
pause >nul

echo.
echo Dang tat cac server...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
echo Da dong toan bo chuong trinh an toan!
timeout /t 2 /nobreak >nul
