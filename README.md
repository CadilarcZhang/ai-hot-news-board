# 今日热搜榜 - AI智能图文生成

一个基于 Node.js 和 Express 的应用，可以获取热搜数据并使用 AI 生成解读内容及热搜新闻图片。

## 功能特点

- 获取微博、头条、抖音等平台的热搜数据
- 使用 AI 生成热搜解读内容
- 支持深色/浅色主题切换
- 响应式设计，适配移动设备
- 使用 AI 生成热搜新闻图片

## 技术栈

| 层级 | 技术选型 |
|------|----------|
| 后端框架选型 |
| | Node.js + Express.js |
| 前端 | Vanilla JavaScript + CSS（响应式） |
| AI 服务 | SiliconFlow API (DeepSeek-V3.2-Exp 文本, Kolors 图片) |
| 数据源 | TianAPI (热搜数据) |
| 部署平台 | Vercel |
| 性能监控 | Vercel Analytics + Web Vitals |

## 项目架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (Browser)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   PC UI     │  │ Mobile UI   │  │  Local Storage      │ │
│  │  (左右布局)  │  │  (垂直列表)  │  │  (缓存层)           │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │ EventSource / fetch
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express Server (server.js)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │  增强缓存系统  │  │  SSE Streaming │  │  路由处理        │ │
│  │  (内存+TTL)  │  │  (实时推送)    │  │  (API + SPA)    │ │
│  └──────────────┘  └──────────────┘  └──────────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│  TianAPI     │ │ SiliconFlow  │ │  Google/Baidu    │
│  (热搜数据)   │ │ (AI生成)     │ │  (联网搜索)       │
└──────────────┘ └──────────────┘ └──────────────────┘
```

## 项目结构

```
ai-hot-news-board/
├── server.js              # 主入口文件 (~1800行)，包含所有核心逻辑
├── package.json          # 项目配置和依赖
├── vercel.json           # Vercel 部署配置
├── CLAUDE.md             # Claude Code 开发规范
├── config/
│   └── index.js          # 配置文件
├── controllers/
│   ├── hotNewsController.js   # 热搜数据控制器
│   └── contentController.js    # 内容生成控制器
├── routes/
│   ├── api.js            # API 路由定义
│   └── historyRoutes.js  # 历史记录路由
├── models/
│   └── HotNewsHistory.js # MongoDB 数据模型
├── public/               # 前端静态资源
│   ├── index.html       # 主页面
│   ├── styles.css       # 样式表
│   ├── script.js        # 主应用逻辑 (~2100行)
│   ├── favicon.svg      # 图标
│   └── js/
│       ├── api.js        # API 通信层
│       ├── ui.js         # UI 渲染
│       └── utils.js      # 工具函数
└── tests/
    └── api.test.js       # API 测试
```

## 核心功能模块

### 1. 热搜获取 (server.js:393-436)

- **平台支持**: weibo / toutiao / douyin / networkhot
- **数据源**: TianAPI
- **缓存策略**: 5分钟 TTL

### 2. AI 内容生成 (server.js:438-717)

- **模型**: DeepSeek-V3.2-Exp (via SiliconFlow)
- **通信**: SSE 流式输出
- **缓存**: 1小时 TTL + 相似度匹配

### 3. 联网搜索 (server.js:719+)

- **主用**: Google Custom Search API
- **备用**: 百度搜索 + Cheerio 网页抓取
- **重试**: 最多2次重试，递增延迟

### 4. AI 图片生成

- **模型**: Kwai-Kolors/Kolors (1024x1024)
- **用途**: 为热搜话题生成配图

### 5. 增强缓存系统 (server.js:18-145)

- **特点**:
  - 多层缓存（内存）
  - Jaccard 相似度匹配
  - 自动清理过期项目
  - 缓存命中率统计

## API 端点

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/hot-news` | GET | 获取热搜数据 |
| `/api/generate-content` | POST | AI 内容生成（SSE） |
| `/api/generate-with-search` | GET | 联网搜索 + AI 生成 |
| `/api/generate-image` | POST | AI 图片生成 |
| `/api/search` | GET | 联网搜索 |
| `/api/cache-stats` | GET | 缓存统计 |
| `/api/cache-warmup` | POST | 缓存预热 |
| `/api/hot-news/history` | GET/POST | 历史记录管理 |

## 环境变量

| 变量 | 说明 |
|------|------|
| `PORT` | 服务端口（默认 3001） |
| `TIANAPI_KEY` | 天行 API 密钥 |
| `AI_API_KEY` | SiliconFlow API 密钥 |
| `GOOGLE_SEARCH_API_KEY` | Google 搜索 API 密钥 |
| `GOOGLE_SEARCH_ENGINE_ID` | Google 搜索引擎 ID |
| `BASE_PATH` | 基础路径（Vercel 为空） |

## 开发命令

```bash
npm run dev        # 开发模式 (nodemon)
npm run local      # 本地开发 (BASE_PATH=/hot-news)
npm start          # 生产启动
npm run build      # 构建
npm run deploy     # 部署
```

## 技术亮点

1. **成本优化**: 缓存 + 相似度匹配减少 AI API 调用
2. **实时体验**: SSE 流式输出，即时内容展示
3. **离线支持**: localStorage 缓存改善用户体验
4. **可观测性**: Vercel Analytics 数据驱动优化
5. **可扩展性**: 控制器 + 路由模式易于功能扩展

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

