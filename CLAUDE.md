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
- `server.js` - Main Express server (~1700 lines) containing most logic
- `controllers/` - Business logic separation (hotNewsController, contentController)
- `routes/` - API route definitions
- `config/` - Application configuration
- `public/` - Frontend assets (HTML, CSS, JS)

**Key Patterns:**
- Advanced caching system with similarity matching to reduce AI API calls
- Server-Sent Events (SSE) for real-time AI content streaming
- Multi-platform news aggregation with platform-specific endpoints
- Fallback mechanisms for web scraping when APIs fail
- Environment-based configuration (BASE_PATH support for different deployments)

## Development Commands

```bash
# Development with hot-reload
npm run dev

# Production server
npm start

# Local development with base path
npm run local

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

## Key Implementation Details

**Caching System** (`server.js:18-170`):
- Multi-layered in-memory cache with TTL
- Similarity-based content matching using string distance algorithms
- Cache statistics tracking (hits, misses, hit rate)
- Automatic cleanup of expired items

**SSE Streaming** (`server.js`):
- Real-time AI content generation streaming
- Client-side EventSource handling in `public/script.js`
- Connection timeout and error handling

**Platform Support**:
- `networkhot` - All-platform aggregation
- `toutiao` - Toutiao hot topics
- `douyin` - Douyin hot topics

**Web Scraping Fallback**:
- When TianAPI fails, falls back to web scraping with Cheerio
- Handles different HTML structures per platform

## Vercel Deployment

The `vercel.json` configuration:
- API routes: `/api/*` → `server.js`
- Static assets: Cached with 1-year expiry
- Catch-all route: `/(.*)` → `server.js` for SPA-like behavior

**Important:** On Vercel, `BASE_PATH` should be empty string to use root paths.

## API Endpoints

- `GET /api/hot-news?platform={platform}` - Fetch hot news by platform
- `GET /api/generate-content?title={title}` - Generate AI content (SSE stream)
- `GET /api/search?q={query}` - Web search (Google + Baidu fallback)
- `POST /api/generate-image` - Generate AI image for news topic
- `GET /api/cache-stats` - Cache statistics

## Frontend Architecture

**JavaScript Files:**
- `public/script.js` - Main application logic
- `public/js/api.js` - API communication layer
- `public/js/ui.js` - UI rendering and interactions
- `public/js/utils.js` - Utility functions

**UI Structure:**
- Left panel: Platform tabs + hot news list
- Right panel: AI-generated content display
- Theme toggle (dark/light mode)
- Search mode toggle (connected search vs local generation)