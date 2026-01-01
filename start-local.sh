#!/bin/bash
echo "停止之前的服务..."
pkill -f "node server.js" || true

# 设置环境变量
export PORT=3001
export BASE_PATH="/hot-news"
export NODE_ENV="development"

# 启动服务器
node server.js