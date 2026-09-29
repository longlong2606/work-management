@echo off
chcp 65001 >nul
color 0b
title WorkShiftPro - Khoi Chay Song Song (May Tinh + TV 50 Inch)
cls
echo =====================================================================
echo          HE THONG WORKSHIFTPRO - KHOI CHAY DUAL SCREEN
echo =====================================================================
echo.

echo [1/5] Dang lay dia chi IP mang hien tai cua may tinh...
set LOCAL_IP=10.25.36.179
for /f %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -InterfaceAlias 'Wi-Fi' -AddressFamily IPv4 -ErrorAction SilentlyContinue).IPAddress"') do (
    if not "%%i"=="" set LOCAL_IP=%%i
)
echo       -^> Dia chi IP mang Wi-Fi hien tai: %LOCAL_IP%
echo.

echo [2/5] Dang giai phong cac cong 8000, 5173, 5174 neu dang bi chiem giu...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5174 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
echo       -^> Cac cong mang da san sang!
echo.

echo [3/5] Dang khoi chay Backend API (.NET 10 tren cong 8000)...
start "1. Backend API (:8000)" cmd /k "cd /d %~dp0backend && dotnet run"
timeout /t 3 /nobreak >nul

echo [4/5] Dang khoi chay Web Quan Ly May Tinh (tren cong 5173)...
start "2. Web May Tinh (:5173)" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 2 /nobreak >nul

echo [5/5] Dang khoi chay Web Man Hinh TV 50 Inch (tren cong 5174)...
start "3. Web TV 50 Inch (:5174)" cmd /k "if exist %~dp0tv-display (cd /d %~dp0tv-display) else (cd /d C:\Projects\work_management) && npm run dev"
timeout /t 3 /nobreak >nul

echo.
echo =====================================================================
echo                   KHOI CHAY HOAN TAT 100%%!
echo =====================================================================
echo.
echo  * Web Quan Ly May Tinh:     http://localhost:5173
echo  * Web Man Hinh TV 50 Inch:  http://localhost:5174
echo.
echo  >>> DIA CHI MO TREN SMART TV (CHUNG WI-FI/LAN):
echo      http://%LOCAL_IP%:5174
echo.
echo =====================================================================
echo.
echo Dang mo trinh duyet cho ca 2 giao dien tren may tinh...
start http://localhost:5173
start http://localhost:5174
echo.
echo [Huong dan]
echo - Tren trinh duyet cua TV 50 inch, ban hay nhap dung dia chi:
echo   http://%LOCAL_IP%:5174
echo - Nhan F11 tren TV de phong toan man hinh.
echo.
echo Nhan phim bat ky de DONG TAT CA cac server va thoat...
pause >nul

echo.
echo Dang tat cac server...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5174 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
echo Da dong toan bo chuong trinh an toan!
timeout /t 2 /nobreak >nul
