#!/usr/bin/env bash

set -e

echo ""
echo "==============================================="
echo "   toonflow 启动器"
echo "==============================================="
echo ""

echo "INFO: 正在终止旧的进程..."

# 1. 通过端口号查找并终止旧进程
for port in 10588 10588; do
    pid=$(lsof -ti :"$port" 2>/dev/null || true)
    if [ -n "$pid" ]; then
        echo "INFO: 发现端口 $port 被 PID $pid 占用，正在清理..."
        kill -9 "$pid" 2>/dev/null || true
    fi
done

# 2. 等待清理完成
sleep 2

# 设置项目根目录并进入
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"


# 启动前端服务
echo "INFO: 正在启动前端服务 (Vite)..."

# 确保 node_modules/.bin 下的二进制文件有执行权限
find "$ROOT_DIR/node_modules/.bin" -maxdepth 1 -type f ! -executable -exec chmod +x {} \; 2>/dev/null || true

(cd "$ROOT_DIR" && npm run dev) &
FRONTEND_PID=$!

echo "INFO: 服务启动中，请稍候..."
sleep 5

echo "INFO: 正在打开浏览器访问应用..."
if command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:10588"
elif command -v open &>/dev/null; then
    open "http://localhost:10588"
else
    echo "INFO: 请手动打开浏览器访问 http://localhost:10588"
fi

wait