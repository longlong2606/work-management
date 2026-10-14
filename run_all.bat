@echo off
chcp 65001 >nul
color 0b
title WorkShiftPro - Khoi Chay He Thong (May Tinh + Dien Thoai + Smart TV)
cls
echo =====================================================================
echo          HE THONG WORKSHIFTPRO - UNIFIED MULTI-PLATFORM
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

rem Xac dinh thu muc Backend
set BACKEND_DIR=%~dp0backend
if not exist "%BACKEND_DIR%" set BACKEND_DIR=%~dp0..\work-managementackend
if not exist "%BACKEND_DIR%" set BACKEND_DIR=C:\Projects\work-management\backend

rem Xac dinh thu muc Frontend
set FRONTEND_DIR=%~dp0frontend
if not exist "%FRONTEND_DIR%" (
    if exist "%~dp0package.json" (
        set FRONTEND_DIR=%~dp0
    ) else (
        set FRONTEND_DIR=C:\Projects\work-management\frontend
    )
)

echo [3/4] Dang khoi chay Backend API (.NET 10 tren cong 8000)...
start "1. Backend API (:8000)" cmd /k "cd /d %BACKEND_DIR% && dotnet run"
timeout /t 3 /nobreak >nul

echo [4/4] Dang khoi chay Web App Tong Hop (tren cong 5173)...
start "2. Web App Unified (:5173)" cmd /k "cd /d %FRONTEND_DIR% && npm run dev"
timeout /t 3 /nobreak >nul

echo.
echo =====================================================================
echo                   KHOI CHAY HOAN TAT 100%%!
echo =====================================================================
echo.
echo  * Web Quan Ly & Lich Ca (PC / Mac):     http://localhost:5173
echo  * Man Hinh Kiosk Smart TV:               http://localhost:5173/tv
echo.
echo  >>> DIA CHI MO TREN DIEN THOAI (CHUNG WI-FI):
echo      http://%LOCAL_IP%:5173
echo.
echo  >>> DIA CHI MO TREN SMART TV (CHUNG WI-FI):
echo      http://%LOCAL_IP%:5173/tv
echo.
echo =====================================================================
echo.
echo Dang mo trinh duyet tren may tinh...
start http://localhost:5173
echo.
echo [Huong dan su dung Dien Thoai & TV]
echo - Tren Dien Thoai (Safari/Chrome): vao http://%LOCAL_IP%:5173 (hoac quet ma QR trong web).
echo - Co san thanh dieu huong duoi man hinh giup cham chon lich ca, nhiem vu, ghi chu cuc de.
echo - Tren Smart TV: truy cap http://%LOCAL_IP%:5173/tv va nhan F11 de xem toan man hinh.
echo.
echo Nhan phim bat ky de DONG TAT CA cac server va thoat...
pause >nul

echo.
echo Dang tat cac server...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
echo Da dong toan bo chuong trinh an toan!
timeout /t 2 /nobreak >nul
