# 今日热搜榜 - AI智能图文生成

一个基于 Node.js 和 Express 的应用，可以获取热搜数据并使用 AI 生成解读内容及热搜新闻图片。

## 功能特点

- 获取微博、头条、抖音等平台的热搜数据
- 使用 AI 生成热搜解读内容
- 支持深色/浅色主题切换
- 响应式设计，适配移动设备
- 使用 AI 生成热搜新闻图片

## 安装和运行

### 前提条件

- Node.js 14.0 或更高版本
- npm 或 yarn

### 安装步骤

1. 克隆仓库
   ```
   git clone https://github.com/yourusername/hot-news-ai.git
   cd hot-news-ai
   ```

2. 安装依赖
   ```
   npm install
   ```

3. 创建 .env 文件并设置环境变量
   ```
   PORT=3001
   TIANAPI_KEY=your_tianapi_key
   AI_API_KEY=your_ai_api_key
   ```

4. 启动服务
   ```
   npm start
   ```
   或
   ```
   ./deploy.sh
   ```

5. 访问应用
   打开浏览器，访问 http://localhost:3001/hot-news

## 部署

使用提供的部署脚本:
```
./deploy.sh
```

## 注意事项

- 部署脚本会自动将项目部署到服务器上，并启动服务。

