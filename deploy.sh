#!/bin/bash
echo "🚀 Đang triển khai hệ thống Quản lý ca làm việc (PostgreSQL + .NET + Nginx) lên Docker..."

docker compose up --build -d

echo ""
echo "================================================="
echo "🎉 HỆ THỐNG ĐÃ SẴN SÀNG TRÊN DOCKER (POSTGRESQL)!"
echo "🌐 Giao diện Web:   http://localhost:3000"
echo "📡 Backend API:     http://localhost:8001/api"
echo "🐘 PostgreSQL DB:   localhost:5432 (Database: work_management)"
echo "================================================="
