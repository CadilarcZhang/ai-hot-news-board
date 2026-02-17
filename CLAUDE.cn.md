# CLAUDE.cn.md

本文件为 Claude Code (claude.ai/code) 提供代码库开发指导。

> **重要说明：** 本项目的所有开发活动必须严格遵守全局 CLAUDE.md 规范 (`~/.claude/CLAUDE.md`)，包括但不限于：
>
> - 代码质量原则（KISS、DRY、单一职责等）
> - Git 提交规范（feat/fix/docs/style 前缀）
> - 安全规范（敏感信息禁止硬编码、使用环境变量）
> - 命名规范（camelCase、PascalCase、UPPER_SNAKE_CASE）
> - API 设计规范（RESTful、状态码规范）
> - 错误处理规范（Fail Fast、明确错误信息）
>
> 项目级配置仅用于提供项目上下文信息，**全局规范优先级最高**。

## 项目概述

基于 Node.js/Express 构建的 AI 驱动的热点新闻聚合和内容生成平台。从多个中文平台（微博、头条、抖音）获取热门话题，并使用 AI 为每条新闻生成专业分析文章和配图。

**技术栈：**

- 后端：Node.js + Express.js，Bull Queue（Redis 任务队列）
- 前端：原生 JavaScript，响应式 CSS，支持深色/浅色主题
- AI 服务：SiliconFlow API（DeepSeek-V3-Exp、Qwen/QwQ-32B），Kolors 图片生成
- 数据来源：TianAPI 热门新闻数据
- 部署：Vercel 优化配置，自定义路由

## 架构

**混合单体结构：**

- `server.js` - 主 Express 服务器，包含核心逻辑
- `controllers/` - 业务逻辑分离（hotNewsController、contentController）
- `routes/` - API 路由定义
- `utils/cache.js` - 缓存工具，支持 TTL 和相似度匹配
- `public/` - 前端静态资源（HTML、CSS、JS）

**核心模式：**

- Server-Sent Events（SSE）实时 AI 内容流式输出
- 多平台新闻聚合，针对不同平台使用不同接口
- 基于 localStorage 的浏览历史（客户端持久化）
- 双层缓存机制：localStorage 内容缓存（10分钟）+ 历史记录缓存（不过期）
- 基于环境变量的配置（支持不同部署路径 BASE_PATH）

## 开发命令

```bash
# 热重载开发模式
npm run dev

# 生产环境启动
npm start

# 本地开发（带 base path）
sh ./start-local.sh

# 构建部署
npm run build

# 部署（构建 + 启动）
npm run deploy
```

**环境变量**（在 `.env` 文件中配置）：

- `PORT` - 服务器端口（默认：3001）
- `TIANAPI_KEY` - TianAPI 密钥，用于获取热门新闻
- `AI_API_KEY` - SiliconFlow API 密钥，用于 AI 内容生成
- `GOOGLE_SEARCH_API_KEY` - Google 自定义搜索 API 密钥
- `GOOGLE_SEARCH_ENGINE_ID` - Google 搜索引擎 ID
- `BASE_PATH` - 基础 URL 路径（Vercel 为空，本地为 `/hot-news`）
- `NODE_ENV` - 环境（development/production）

## 核心实现细节

### 浏览历史模块（`public/script.js`）

**存储方式：** localStorage，键名为 `hot_news_history`

```javascript
{
  "hot_news_history": [
    { "id": "xxx", "title": "...", "heat": "...", "platform": "...", "browseTime": "...", "content": {...} }
  ]
}
```

**核心函数：**

- `getHistoryList()` - 从 localStorage 获取历史记录
- `saveToHistory(news)` - 保存/更新历史记录
- `renderHistoryList()` - 渲染历史列表 UI

**缓存策略：**

- 历史记录点击：优先使用 `history.content`（不过期）→ 没有则调用 API
- 普通点击：优先使用 `localStorage` 缓存（10分钟过期）→ 没有则调用 API

### 内容缓存模块（`public/script.js`）

**存储方式：** localStorage，键名为 `content-{title}`

```javascript
{
  "html": "...",      // 格式化后的 HTML
  "articles": [...],  // 参考来源链接
  "expiry": 1234567890000  // 过期时间（创建后10分钟）
}
```

**核心函数：**

- `getCachedContent(title)` - 获取有效缓存或 null
- `renderCachedContent(newsContent, cachedData, title, heat)` - 渲染缓存内容

### SSE 流式输出（`public/script.js`）

- 实时 AI 内容流式生成
- EventSource 处理，包含超时和错误处理
- 在 `fullContent` 变量中累积部分内容

## API 接口

- `GET /api/hot-news?platform={platform}` - 获取指定平台热门新闻
- `GET /api/generate-content?title={title}` - 生成 AI 内容（SSE 流式）
- `GET /api/search?q={query}` - 网络搜索（Google + 百度备用）
- `POST /api/generate-image` - 生成 AI 图片
- `GET /api/cache-stats` - 缓存统计信息

## 前端架构

**JavaScript 文件：**

- `public/script.js` - **主应用逻辑**（约 2000 行，包含所有模块）
  - `saveToHistory()` / `getHistoryList()` / `renderHistoryList()` - 历史模块
  - `getCachedContent()` / `renderCachedContent()` - 内容缓存模块
  - `generateAIContent()` - AI 内容生成（SSE）
  - `showNewsContent()` - 内容显示控制器（判断缓存还是 API）
  - `createSVGImage()` / `generateImageForContent()` - 图片生成

**注意事项：** 所有核心函数都定义在 `DOMContentLoaded` 回调**内部**，通过 `window.fn = fn` 方式暴露给外部访问。

**UI 结构：**

- 左侧面板：平台 Tab + 热门新闻列表
- 右侧面板：AI 生成的内容展示
- 主题切换（深色/浅色模式）
- 搜索模式切换（联网搜索 vs 本地生成）
- 历史记录 Tab（位于平台 Tab 栏）

## Vercel 部署

`vercel.json` 配置：

- API 路由：`/api/*` → `server.js`
- 静态资源：缓存有效期 1 年
- 兜底路由：`/(.*)` → `server.js`（SPA 行为）

**注意：** 在 Vercel 部署时，`BASE_PATH` 应为空字符串以使用根路径。

## 代码位置参考

引用代码时请包含行号以便快速定位：

- 历史模块：`public/script.js:170-320`
- 内容缓存：`public/script.js:330-420`
- SSE 生成：`public/script.js:1250-1450`
- 内容展示：`public/script.js:1700-1870`

## 最佳实践

1. **技术文档：** 所有实现决策必须在 `docs/` 文件夹中记录
2. **测试：** 新功能实现后立即测试
3. **作用域管理：** DOMContentLoaded 内部函数需要 `window.fn = fn` 才能外部访问
4. **缓存失效：** 历史记录 content 不过期，localStorage 缓存 10 分钟过期
