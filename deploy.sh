#!/bin/bash
echo "🚀 Đang triển khai hệ thống Quản lý ca làm việc lên Docker..."

mkdir -p data
if [ -f "backend/work_management.db" ] && [ ! -f "data/work_management.db" ]; then
    cp backend/work_management.db data/work_management.db
    echo "📦 Đã sao chép CSDL ban đầu sang data/work_management.db"
fi

docker compose up --build -d

echo ""
echo "================================================="
echo "🎉 HỆ THỐNG ĐÃ SẴN SÀNG TRÊN DOCKER!"
echo "🌐 Giao diện Web: http://localhost:3000"
echo "📡 Backend API:   http://localhost:8001/api"
echo "================================================="
