# AGENTS.md

## Build & Development Commands

### Start Development Server
```bash
npm start                # Start production server
npm run dev             # Start with nodemon (auto-restart)
npm run local           # Run with BASE_PATH=/hot-news (local testing)
```

### Build & Deploy
```bash
npm run build           # Copy files to dist/ directory
npm run deploy          # Build and start from dist/
./deploy.sh             # Full deployment script to Vercel
```

### Testing
```bash
# Note: Jest is referenced in tests/ but not fully configured in package.json
# Tests should be run manually or via:
node tests/api.test.js  # Run test file directly (if executable)
# Or configure: npm test -- tests/api.test.js
```

## Code Style Guidelines

### Backend (Node.js/Express)

**Imports & Modules**
- Use CommonJS (`require`/`module.exports`) for all backend files
- Order imports: 1) Built-in modules, 2) External packages, 3) Local modules
```javascript
const express = require('express');
const axios = require('axios');
const config = require('./config');
```

**Function Exports**
- Use `exports.functionName = ...` or `module.exports = { ... }`
- Controller exports: `exports.getHotNews = async (req, res, next) => { }`

**Error Handling**
- Use try-catch for async operations
- Pass errors to `next()` middleware in Express routes
- Include `process.env` fallbacks with sensible defaults
```javascript
const API_KEY = process.env.API_KEY || 'default_key';
```

**Naming Conventions**
- Variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE` (API keys, endpoints)
- Functions: `camelCase`
- Files: `camelCase.js` or `kebab-case.js` (routes, controllers)

**Comments**
- Use JSDoc-style comments for functions
- Add inline comments for complex logic
- Include Chinese comments for business logic (project convention)

### Frontend (JavaScript)

**Imports & Modules**
- Use ES6 modules (`import`/`export`)
- Import dependencies in order: external libraries, local modules
```javascript
import API from './api.js';
import { formatContent, debounce } from './utils.js';
```

**Object-Oriented Structure**
- Use object literals for organizing related functionality
- Group functions into logical modules (API, UI, Utils)
```javascript
const UI = {
    init() { },
    setupEventListeners() { },
    async fetchHotNews() { }
};
export default UI;
```

**Event Handling**
- Use `addEventListener` with arrow functions or bound methods
- Include loading states and error handling for async operations
- Use `debounce` or `throttle` for performance-sensitive events

**DOM Manipulation**
- Use `document.querySelector` and `document.querySelectorAll`
- Cache DOM elements when used multiple times
- Clean up event listeners in single-page applications

**CSS Conventions**
- Use BEM-style naming: `.block__element--modifier`
- Include dark theme styles in same CSS file with `@media (prefers-color-scheme)`
- Mobile-first responsive design with `@media (min-width)`

### Configuration

**Environment Variables**
- Store in `.env` (ignored by git)
- Use `dotenv` at the very top of server.js
- Provide fallback defaults for all required variables
- Never commit actual API keys or secrets

**API Keys**
- Store in `config/index.js` as fallback values
- Override with `process.env` in production
- Document all required environment variables in README

### Caching Strategy

- Cache hot news: 15 minutes (900s) to 5 minutes (300s)
- Cache AI content: 1 hour (3600s) or longer
- Use cache keys with prefixes: `hot-news-{platform}`, `content-{title}`
- Implement cache expiration and cleanup

### SSE (Server-Sent Events)

- Set appropriate headers: `Content-Type: text/event-stream`
- Use `safeWrite` helper to prevent writing to closed streams
- Implement timeout handling (30s default for Vercel)
- Use buffering to handle chunk boundaries correctly

### Testing Patterns

- Use Jest for unit tests (when configured)
- Mock external dependencies (axios, cache modules)
- Test both success and error paths
- Include edge cases (missing parameters, empty responses)

### File Structure

```
project-root/
├── server.js           # Main Express server
├── app.py             # Flask backup server
├── worker.js           # Background job queue
├── config/            # Configuration files
├── controllers/       # Route handlers
├── routes/            # Express route definitions
├── tests/             # Test files
├── public/            # Static assets
│   ├── index.html
│   ├── styles.css
│   ├── script.js
│   └── js/            # ES6 modules
│       ├── api.js
│       ├── ui.js
│       └── utils.js
└── package.json
```

## Important Notes

- Vercel deployment requires `BASE_PATH` to be empty string in production
- Local development uses `BASE_PATH=/hot-news`
- Server supports both API routes and static file serving
- AI API uses SiliconFlow with DeepSeek-V3.2-Exp model
- TianAPI for hot news data (free tier limits: 100 requests/day)
- Google Search API is optional, falls back to web scraping
