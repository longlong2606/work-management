@echo off
chcp 65001 >nul
title Tat Tat Ca Server WorkShiftPro
echo Dang tat tat ca server (8000, 5173, 5174)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5174 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
echo Da giai phong toan bo cac cong va dong chuong trinh thanh cong!
timeout /t 2 /nobreak >nul
