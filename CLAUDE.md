# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **重要说明：** 本项目的所有开发活动必须严格遵守全局 CLAUDE.md 规范 (`~/.claude/CLAUDE.md`)，包括但不限于：
> - 代码质量原则（KISS、DRY、单一职责等）
> - Git 提交规范（feat/fix/docs/style 前缀）
> - 安全规范（敏感信息禁止硬编码、使用环境变量）
> - 命名规范（camelCase、PascalCase、UPPER_SNAKE_CASE）
> - API 设计规范（RESTful、状态码规范）
> - 错误处理规范（Fail Fast、明确错误信息）
>
> 项目级配置仅用于提供项目上下文信息，**全局规范优先级最高**。

## Project Overview

This is an AI-powered hot news aggregation and content generation platform built with Node.js/Express. It fetches trending topics from multiple Chinese platforms (Weibo, Toutiao, Douyin) and uses AI to generate professional analysis and images for each news item.

**Tech Stack:**

- Backend: Node.js with Express.js, Bull Queue (Redis job processing)
- Frontend: Vanilla JavaScript, responsive CSS with dark/light theme
- AI Services: SiliconFlow API (DeepSeek-V3.2-Exp, Qwen/QwQ-32B), Kolors for image generation
- Data Source: TianAPI for hot news data
- Deployment: Vercel-optimized with custom routing

## Architecture

**Hybrid Monolithic Structure:**

- `server.js` - Main Express server containing most logic
- `controllers/` - Business logic separation (hotNewsController, contentController)
- `routes/` - API route definitions
- `utils/cache.js` - Caching utility with TTL and similarity matching
- `public/` - Frontend assets (HTML, CSS, JS)

**Key Patterns:**

- Server-Sent Events (SSE) for real-time AI content streaming
- Multi-platform news aggregation with platform-specific endpoints
- LocalStorage-based browse history (client-side persistence)
- Dual-layer caching: localStorage content cache (10min) + history cache (no expiry)
- Environment-based configuration (BASE_PATH support for different deployments)

## Development Commands

```bash
# Development with hot-reload
npm run dev

# Production server
npm start

# Local development with base path
sh ./start-local.sh

# Build for deployment
npm run build

# Deploy (build + start)
npm run deploy
```

**Environment Variables** (set in `.env`):

- `PORT` - Server port (default: 3001)
- `TIANAPI_KEY` - TianAPI key for hot news data
- `AI_API_KEY` - SiliconFlow API key for AI content generation
- `GOOGLE_SEARCH_API_KEY` - Google Custom Search API key
- `GOOGLE_SEARCH_ENGINE_ID` - Google Search Engine ID
- `BASE_PATH` - Base URL path (empty on Vercel, `/hot-news` for local)
- `NODE_ENV` - Environment (development/production)

## Git Workflow

**分支管理规范：**

- **main**: 生产分支，禁止直接推送
- **feature/***: 功能分支，通过 PR 合并到 main
- **refactor/***: 重构分支，通过 PR 合并到 main
- **fix/***: 修复分支，通过 PR 合并到 main

**开发流程：**

```bash
# 1. 创建 feature worktree（推荐）
git worktree add ../ai-hot-news-refactor feature/xxx
cd ../ai-hot-news-refactor

# 2. 开发和提交
git add .
git commit -m "feat: xxx"
git push origin feature/xxx

# 3. 创建 PR（必须使用 PR 合并，禁止直接推送到 main）
gh pr create --title "feat: xxx" --body "..." --base main --head feature/xxx

# 4. PR 合并后清理
git checkout main
git branch -d feature/xxx
```

**⚠️ 重要约束：**

- **禁止直接 `push` 到 `main` 分支**（包括 `git push origin feature/xxx:main`）
- **所有改动必须通过 PR 合并**，经过 Code Review 后再合并
- 使用 `git worktree` 进行并行开发，避免频繁切换分支
- PR 合并后，feature 分支可以删除，worktree 可以继续用于新功能开发

## Key Implementation Details

### Browse History Module (`public/script.js`)

**Storage:** localStorage with key `hot_news_history`

```javascript
{
  "hot_news_history": [
    { "id": "xxx", "title": "...", "heat": "...", "platform": "...", "browseTime": "...", "content": {...} }
  ]
}
```

**Core Functions:**

- `getHistoryList()` - Get history from localStorage
- `saveToHistory(news)` - Save/update history record
- `renderHistoryList()` - Render history list UI

**Caching Strategy:**

- History click: use `history.content` (no expiry) → API if empty
- Normal click: use `localStorage` cache (10min expiry) → API if empty

### Content Caching (`public/script.js`)

**Storage:** localStorage with key `content-{title}`

```javascript
{
  "html": "...",  // Formatted HTML
  "articles": [...],  // Reference links
  "expiry": 1234567890000  // 10 minutes from creation
}
```

**Core Functions:**

- `getCachedContent(title)` - Get valid cache or null
- `renderCachedContent(newsContent, cachedData, title, heat)` - Render cached content

### SSE Streaming (`public/script.js`)

- Real-time AI content generation streaming
- EventSource handling with timeout and error handling
- Partial content accumulation in `fullContent` variable

## API Endpoints

- `GET /api/hot-news?platform={platform}` - Fetch hot news by platform
- `GET /api/generate-content?title={title}` - Generate AI content (SSE stream)
- `GET /api/search?q={query}` - Web search (Google + Baidu fallback)
- `POST /api/generate-image` - Generate AI image for news topic
- `GET /api/cache-stats` - Cache statistics

## Frontend Architecture

**JavaScript Files:**
- `public/script.js` - **Main application logic** (~2000 lines, contains all modules)
  - `saveToHistory()` / `getHistoryList()` / `renderHistoryList()` - History module
  - `getCachedContent()` / `renderCachedContent()` - Content cache module
  - `generateAIContent()` - AI content generation (SSE)
  - `showNewsContent()` - Content display controller (determines cache vs API)
  - `createSVGImage()` / `generateImageForContent()` - Image generation

**Important:** All major functions are defined **inside** `DOMContentLoaded` callback for proper scope. External access via `window.functionName = functionName`.

**UI Structure:**
- Left panel: Platform tabs + hot news list
- Right panel: AI-generated content display
- Theme toggle (dark/light mode)
- Search mode toggle (connected search vs local generation)
- History tab in platform tabs row

## Vercel Deployment

The `vercel.json` configuration:
- API routes: `/api/*` → `server.js`
- Static assets: Cached with 1-year expiry
- Catch-all route: `/(.*)` → `server.js` for SPA-like behavior

**Important:** On Vercel, `BASE_PATH` should be empty string to use root paths.

## Code Location Reference

When referencing code, include line numbers for quick navigation:
- History module: `public/script.js:170-320`
- Content cache: `public/script.js:330-420`
- SSE generation: `public/script.js:1250-1450`
- Content display: `public/script.js:1700-1870`

## Best Practices

1. **Technical Documentation:** All implementation decisions must be documented in `docs/` folder
2. **Testing:** Test new features immediately after implementation
3. **Scope Management:** DOMContentLoaded internal functions need `window.fn = fn` for external access
4. **Cache Invalidation:** History content has no expiry, localStorage cache expires in 10min