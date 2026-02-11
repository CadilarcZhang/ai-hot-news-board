# 今日热搜榜 - AI智能图文生成

一个基于 Node.js 和 Express 的 AI 热点新闻聚合平台，实时获取微博、头条、抖音等平台的热搜数据，使用 AI 生成专业解读内容和配图。

## 功能特点

- **多平台热搜聚合**：支持微博、头条、抖音等平台的热搜数据获取
- **AI 智能解读**：使用 DeepSeek-V3.2-Exp / Qwen-QwQ-32B 模型生成热搜深度分析
- **AI 图片生成**：基于 Kolors 模型自动生成热搜新闻配图
- **实时流式输出**：使用 SSE 技术实现 AI 内容的实时流式展示
- **智能缓存机制**：localStorage 客户端缓存提升性能
- **浏览历史记录**：本地持久化存储用户浏览历史
- **深色/浅色主题**：支持一键切换主题模式
- **响应式设计**：完美适配桌面和移动设备

## 技术栈

- **后端**：Node.js + Express.js
- **前端**：原生 JavaScript + 响应式 CSS
- **AI 服务**：SiliconFlow API（DeepSeek-V3.2-Exp / Qwen/QwQ-32B）
- **图片生成**：Kolors 文生图模型
- **数据源**：TianAPI 热搜数据
- **部署**：Vercel + 自定义路由

## 项目结构

```
ai-hot-news-board/
├── server.js                 # Express 主服务器
├── controllers/              # 业务逻辑层
│   ├── hotNewsController.js  # 热搜数据获取
│   └── contentController.js  # AI 内容生成
├── routes/                   # API 路由定义
├── utils/                    # 工具函数
│   └── cache.js              # 缓存工具
├── public/                   # 前端静态资源
│   ├── index.html            # 主页面
│   ├── styles.css            # 样式文件
│   └── script.js             # 前端逻辑
├── worker.js                 # [遗留] Redis 队列处理器（当前未使用）
├── vercel.json               # Vercel 部署配置
└── package.json              # 项目依赖
```

## 安装和运行

### 前提条件

- Node.js 14.0 或更高版本
- npm 或 yarn

### 安装步骤

1. 克隆仓库
   ```bash
   git clone https://github.com/yourusername/ai-hot-news-board.git
   cd ai-hot-news-board
   ```

2. 安装依赖
   ```bash
   npm install
   ```

3. 配置环境变量
   ```bash
   cp .env.example .env
   # 编辑 .env 文件，填入你的 API 密钥
   ```

4. 启动服务
   ```bash
   # 开发模式（热重载）
   npm run dev

   # 生产模式
   npm start

   # 本地开发（带 base path）
   sh ./start-local.sh
   ```

5. 访问应用
   - 开发环境：http://localhost:3001/hot-news
   - Vercel 部署：https://your-domain.vercel.app

## 环境变量配置

创建 `.env` 文件并配置以下变量：

```env
# 服务配置
PORT=3001                          # 服务器端口
NODE_ENV=development               # 环境：development/production
BASE_PATH=/hot-news                # 基础路径（Vercel 上为空字符串）

# 热搜数据 API（必需）
TIANAPI_KEY=your_tianapi_key

# AI 服务 API（SiliconFlow）（必需）
AI_API_KEY=your_siliconflow_key

# 搜索 API（可选）
GOOGLE_SEARCH_API_KEY=your_google_key
GOOGLE_SEARCH_ENGINE_ID=your_engine_id
```

## API 接口文档

### 获取热搜列表
```
GET /api/hot-news?platform={platform}
```
- `platform`: 平台类型（`weibo` | `toutiao` | `douyin`）

### 生成 AI 解读内容
```
GET /api/generate-content?title={title}
```
- 返回 SSE 流式数据
- `title`: 热搜标题

### 搜索相关内容
```
GET /api/search?q={query}
```
- 优先使用 Google 搜索，失败时回退到百度

### 生成新闻图片
```
POST /api/generate-image
Content-Type: application/json

{
  "title": "热搜标题",
  "content": "AI生成的内容摘要"
}
```

### 缓存统计
```
GET /api/cache-stats
```

## 缓存策略

### 内容缓存（localStorage）
- **Key**: `content-{title}`
- **TTL**: 10 分钟
- 缓存 AI 生成的 HTML 内容和参考链接

### 浏览历史（localStorage）
- **Key**: `hot_news_history`
- **TTL**: 永久保存
- 存储用户浏览过的热搜记录及完整内容

### 获取优先级
1. 历史记录内容（如有）→ 直接展示
2. localStorage 缓存（10分钟内）→ 直接展示
3. 调用 API 生成新内容

## 部署

### Vercel 部署（推荐）

1. 连接 GitHub 仓库到 Vercel
2. 配置环境变量（`BASE_PATH` 留空）
3. 自动部署

### 使用部署脚本
```bash
./deploy.sh
```

### 手动部署
```bash
npm run build
npm run deploy
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式（热重载） |
| `npm start` | 启动生产服务 |
| `npm run build` | 构建项目 |
| `npm run deploy` | 构建并启动（用于部署） |

## 注意事项

1. **API 密钥**：确保 `TIANAPI_KEY` 和 `AI_API_KEY` 已正确配置
2. **BASE_PATH**：本地开发设置为 `/hot-news`，Vercel 上设置为空字符串
3. **CORS**：生产环境请配置允许的域名

## 许可证

MIT License

