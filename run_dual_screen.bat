@echo off
chcp 65001 >nul
title WorkShiftPro - Chay Song Song Web May Tinh & Man Hinh TV
echo =====================================================================
echo    KHOI CHAY HE THONG SONG SONG (WEB MAY TINH + TV 50 INCH)
echo =====================================================================
echo.

echo 1. Khoi chay Backend API (.NET 10 tren port 8000)...
start "Backend API (Port 8000)" cmd /k "cd /d %~dp0backend && dotnet run"

timeout /t 3 /nobreak >nul

echo 2. Khoi chay Web Quan Ly May Tinh (Port 5173)...
start "Web May Tinh (Port 5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 2 /nobreak >nul

echo 3. Khoi chay Web Man Hinh TV (Port 5174)...
start "Web TV 50 Inch (Port 5174)" cmd /k "if exist %~dp0tv-display (cd /d %~dp0tv-display) else (cd /d C:\Projects\work_management) && npm run dev"

timeout /t 3 /nobreak >nul

echo 4. Mo trinh duyet ca 2 man hinh...
start http://localhost:5173
start http://localhost:5174

echo.
echo =====================================================================
echo DA KHOI CHAY THANH CONG CA 2 HE THONG!
echo - Web May Tinh (Dang ky, Quan ly ca): http://localhost:5173
echo - Web Man Hinh TV (Trinh chieu Kiosk): http://localhost:5174
echo - Dia chi TV ket noi chung WiFi:      http://10.25.35.148:5174
echo =====================================================================
echo.
pause
