# Script triển khai Docker 1-click (PostgreSQL Edition)
Write-Host "🚀 Đang triển khai hệ thống Quản lý ca làm việc (PostgreSQL + .NET + Nginx) lên Docker..." -ForegroundColor Cyan

docker compose up --build -d

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=================================================" -ForegroundColor Green
    Write-Host "🎉 HỆ THỐNG ĐÃ SẴN SÀNG TRÊN DOCKER (POSTGRESQL)!" -ForegroundColor Green
    Write-Host "🌐 Giao diện Web:   http://localhost:3000" -ForegroundColor Cyan
    Write-Host "📡 Backend API:     http://localhost:8001/api" -ForegroundColor Cyan
    Write-Host "🐘 PostgreSQL DB:   localhost:5432 (Database: work_management)" -ForegroundColor Cyan
    Write-Host "=================================================" -ForegroundColor Green
} else {
    Write-Host "❌ Có lỗi xảy ra trong quá trình khởi chạy Docker." -ForegroundColor Red
}
