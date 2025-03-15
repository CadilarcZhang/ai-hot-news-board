#!/bin/bash

# 停止之前的服务（如果有）
echo "停止之前的服务..."
pkill -f "node server.js" || true

# 安装依赖
echo "安装依赖..."
npm install

# 构建项目
echo "构建项目..."
npm run build

# 启动服务
echo "启动服务..."
cd dist
NODE_ENV=production nohup node server.js > ../app.log 2>&1 &

echo "服务已启动，运行在端口 3001"
echo "日志文件: app.log" 