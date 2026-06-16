#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DB_NAME="seedance_studio"
DB_USER="$(whoami)"
DB_URL="postgresql://${DB_USER}@localhost:5432/${DB_NAME}"

if ! command -v psql >/dev/null 2>&1; then
  echo "❌ 未检测到 psql，请先安装 Homebrew PostgreSQL："
  echo "   brew install postgresql@15"
  echo "   brew services start postgresql@15"
  exit 1
fi

echo "▶ 检查 PostgreSQL 服务..."
if ! psql -h localhost -U "$DB_USER" -d postgres -c "SELECT 1" >/dev/null 2>&1; then
  echo "❌ 无法连接 PostgreSQL，请先启动服务："
  echo "   brew services start postgresql@15"
  exit 1
fi
echo "✓ PostgreSQL 已运行"

echo "▶ 检查数据库 ${DB_NAME}..."
if ! psql -h localhost -U "$DB_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  echo "  创建数据库 ${DB_NAME}..."
  psql -h localhost -U "$DB_USER" -d postgres -c "CREATE DATABASE ${DB_NAME};"
else
  echo "✓ 数据库已存在"
fi

echo "▶ 同步表结构..."
DATABASE_URL="$DB_URL" pnpm db:push

echo ""
echo "✅ Homebrew PostgreSQL 就绪"
echo ""
echo "连接串（写入 .env.local 的 DATABASE_URL）："
echo "  ${DB_URL}"
echo ""
echo "常用命令："
echo "  brew services start postgresql@15   # 启动"
echo "  brew services stop postgresql@15    # 停止"
echo "  brew services list | grep postgres  # 查看状态"
echo "  pnpm db:studio                      # 可视化查看数据"
