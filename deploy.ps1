# Script triển khai Docker 1-click cho Windows
Write-Host "🚀 Đang triển khai hệ thống Quản lý ca làm việc lên Docker..." -ForegroundColor Cyan

if (!(Test-Path "data")) {
    New-Item -ItemType Directory -Path "data" | Out-Null
    if (Test-Path "backend\work_management.db") {
        Copy-Item "backend\work_management.db" "data\work_management.db"
        Write-Host "📦 Đã đồng bộ CSDL sang ./data/work_management.db" -ForegroundColor Gray
    }
}

docker compose up --build -d

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=================================================" -ForegroundColor Green
    Write-Host "🎉 HỆ THỐNG ĐÃ SẴN SÀNG TRÊN DOCKER!" -ForegroundColor Green
    Write-Host "🌐 Giao diện Web: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "📡 Backend API:   http://localhost:8001/api" -ForegroundColor Cyan
    Write-Host "=================================================" -ForegroundColor Green
} else {
    Write-Host "❌ Có lỗi xảy ra trong quá trình khởi chạy Docker." -ForegroundColor Red
}
