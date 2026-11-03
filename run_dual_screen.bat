@echo off
chcp 65001 >nul
color 0b
title WorkShiftPro - Khoi Chay He Thong 2 Man Hinh (Quan Ly + Kiosk Smart TV)
cls
echo =====================================================================
echo    HE THONG WORKSHIFTPRO - CHE DO 2 MAN HINH (PC + SMART TV)
echo =====================================================================
echo.

echo [1/4] Dang lay dia chi IP mang Wi-Fi/LAN...
set LOCAL_IP=127.0.0.1
for /f "tokens=4" %%a in ('route print 0.0.0.0 ^| findstr 0.0.0.0') do (
    if not "%%a"=="" set LOCAL_IP=%%a
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
if not exist "%BACKEND_DIR%" set BACKEND_DIR=%~dp0..\work-management\backend
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
if exist "%BACKEND_DIR%\bin\Debug\net10.0\backend.exe" (
    start "1. Backend API (:8000)" cmd /k "cd /d %BACKEND_DIR% && bin\Debug\net10.0\backend.exe"
) else (
    start "1. Backend API (:8000)" cmd /k "cd /d %BACKEND_DIR% && dotnet run --no-restore"
)
ping -n 4 127.0.0.1 >nul

echo [4/4] Dang khoi chay Web App Tong Hop (tren cong 5173)...
start "2. Web App Unified (:5173)" cmd /k "cd /d %FRONTEND_DIR% && npm run dev"
ping -n 4 127.0.0.1 >nul

echo.
echo =====================================================================
echo                   KHOI CHAY HOAN TAT 100%%!
echo =====================================================================
echo.
echo  * Man Hinh 1 - Quan Ly ^& Lich Ca:       http://localhost:5173
echo  * Man Hinh 2 - Kiosk Smart TV:          http://localhost:5173/tv
echo.
echo  ^>^>^> DIA CHI MO TREN DIEN THOAI (CHUNG WI-FI):
echo      http://%LOCAL_IP%:5173
echo.
echo  ^>^>^> DIA CHI MO TREN SMART TV (CHUNG WI-FI):
echo      http://%LOCAL_IP%:5173/tv
echo.
echo =====================================================================
echo.
echo Dang mo 2 man hinh tren trinh duyet...
start http://localhost:5173
ping -n 2 127.0.0.1 >nul
start http://localhost:5173/tv
echo.
echo [Huong dan che do 2 Man Hinh]
echo - Man hinh 1: Dung quan ly phan ca, duyet ca, theo doi nhiem vu va CP.
echo - Man hinh 2: Kéo tab /tv sang man hinh Smart TV/man phu va nhan F11 de xem full screen.
echo.
echo Nhan phim bat ky de DONG TAT CA cac server va thoat...
pause >nul

echo.
echo Dang tat cac server...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
echo Da dong toan bo chuong trinh an toan!
ping -n 3 127.0.0.1 >nul
