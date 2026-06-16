#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DOCKER_URL="postgresql://seedance:seedance@localhost:5433/seedance_studio"

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ 未检测到 Docker，请先安装 Docker Desktop："
  echo "   https://www.docker.com/products/docker-desktop/"
  exit 1
fi

echo "▶ 启动 PostgreSQL 容器..."
docker compose up -d postgres

echo "▶ 等待数据库就绪..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U seedance -d seedance_studio >/dev/null 2>&1; then
    echo "✓ PostgreSQL 已就绪"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "❌ 数据库启动超时"
    exit 1
  fi
  sleep 1
done

echo "▶ 同步数据库表结构..."
DATABASE_URL="$DOCKER_URL" pnpm db:push

echo ""
echo "✅ Docker PostgreSQL 部署完成"
echo ""
echo "连接串（写入 .env.local 的 DATABASE_URL）："
echo "  $DOCKER_URL"
echo ""
echo "常用命令："
echo "  docker compose up -d      # 启动"
echo "  docker compose down       # 停止"
echo "  docker compose logs -f    # 查看日志"
