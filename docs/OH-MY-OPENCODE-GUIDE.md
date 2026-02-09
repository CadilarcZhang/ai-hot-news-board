# Oh-My-OpenCode 使用指南

## 项目信息

**项目名称**: ai-hot-news-board  
**安装日期**: 2026-01-11  
**OpenCode 版本**: 1.1.12  
**Bun 版本**: 1.3.5  
**Oh-My-OpenCode 版本**: 2.14.0

---

## 安装完成情况

### ✅ 已完成

1. **OpenCode 安装**
   - 版本: 1.1.12
   - 位置: 已全局安装

2. **Bun 运行时**
   - 版本: 1.3.5
   - 安装路径: `~/.bun/bin/bun`
   - 已添加到 PATH: `~/.zshrc`

3. **Oh-My-OpenCode 安装**
   - 通过 `npm install -g oh-my-opencode` 安装
   - 使用 bunx 运行安装器完成配置

4. **配置文件**
   - `~/.config/opencode/opencode.json` - OpenCode 主配置
   - `~/.config/opencode/oh-my-opencode.json` - Oh-My-OpenCode 配置

### ⚠️ 注意事项

- **Google Gemini 认证**: 已跳过（国内 Google 账户无法通过 antigravity 认证）
- 所有 Agent 配置为使用免费的 `opencode/glm-4.7-free` 模型
- 如需启用 Gemini，需获得海外 Google 账户后重新配置

---

## 配置文件内容

### `~/.config/opencode/opencode.json`

```json
{
  "plugin": [
    "oh-my-opencode"
  ]
}
```

### `~/.config/opencode/oh-my-opencode.json`

```json
{
  "$schema": "https://raw.githubusercontent.com/code-yeongyu/oh-my-opencode/master/assets/oh-my-opencode.schema.json",
  "google_auth": false,
  "agents": {
    "Sisyphus": {
      "model": "opencode/glm-4.7-free"
    },
    "librarian": {
      "model": "opencode/glm-4.7-free"
    },
    "explore": {
      "model": "opencode/glm-4.7-free"
    },
    "oracle": {
      "model": "opencode/glm-4.7-free"
    },
    "frontend-ui-ux-engineer": {
      "model": "opencode/glm-4.7-free"
    },
    "document-writer": {
      "model": "opencode/glm-4.7-free"
    },
    "multimodal-looker": {
      "model": "opencode/glm-4.7-free"
    }
  }
}
```

---

## OpenCode 内置 vs Oh-My-OpenCode 新增功能

### OpenCode 内置的（不是 oh-my-opencode 提供的）

- ✅ `opencode/glm-4.7-free` - OpenCode 自带免费模型
- ✅ 基础文件操作（Read, Write, Edit, Glob, Grep, Bash）
- ✅ 基础 LSP 工具（lsp_hover, lsp_goto_definition 等 - 仅分析用）

### Oh-My-OpenCode 插件新增的

- 🤖 **Agent 框架**（Sisyphus, oracle, librarian, explore 等）- 使用你配置的任何模型
- 🔧 **LSP 增强工具**（lsp_rename, lsp_code_actions, lsp_code_action_resolve, ast_grep_search, ast_grep_replace）
- 🔄 **Background Agents**（后台并行任务）
- 🌐 **内置 MCPs**（websearch, context7, grep_app）
- ⚡ **Hooks**（comment-checker, todo-continuation, session-recovery 等 20+ 个）
- 🪄 **Magic Keywords**（ultrawork, ultrathink, search, analyze 等）
- 📂 **Context 注入**（AGENTS.md, README.md 自动注入）
- 🎯 **Categories**（visual, business-logic 领域分类）
- 📝 **Todo 管理**（系统化的任务追踪）

---

## 可用的 Agents

| Agent | 模型 | 用途 |
|-------|------|------|
| **Sisyphus** | glm-4.7-free | 主编排器，智能分配任务，持续执行直到完成 |
| **oracle** | glm-4.7-free | 架构审查、深度调试、战略规划 |
| **librarian** | glm-4.7-free | 文档查阅、多代码库分析、GitHub 研究 |
| **explore** | glm-4.7-free | 快速代码探索、模式匹配（使用 LSP 工具） |
| **frontend-ui-ux-engineer** | glm-4.7-free | 前端开发、UI/UX 设计 |
| **document-writer** | glm-4.7-free | 技术文档写作 |
| **multimodal-looker** | glm-4.7-free | 多模态分析（PDF、图片等） |

---

## 可用的 Magic Keywords

| 关键字 | 功能 | 触发效果 |
|--------|------|----------|
| `ultrawork` / `ulw` | 最大性能模式 | 并行 agents、后台任务、深度探索、持续执行直到完成 |
| `ultrathink` | 深度思考模式 | 扩展思考 budget，动态调整模型设置 |
| `search` / `find` | 搜索模式 | 并行 explore + librarian agents，最大化搜索力度 |
| `analyze` / `investigate` | 分析模式 | 多阶段专家咨询，深度分析 |

---

## 内置 MCP 服务

| MCP 名称 | 功能 | 说明 |
|----------|------|------|
| **websearch** | 实时网络搜索 | 使用 Exa AI 搜索最新信息 |
| **context7** | 官方文档查询 | 获取库的最新官方文档 |
| **grep_app** | GitHub 代码搜索 | 搜索数百万公共 GitHub 仓库 |

---

## 如何使用

### 方式一：在 opencode 中直接使用

```bash
# 启动 opencode
opencode
```

然后在 opencode 中与 AI 对话：

#### 1. 使用 Magic Keywords（最简单）

```bash
# ultrawork 模式 - 最大性能
"帮我重构这个项目 ultrawork"
"ulw: 添加用户认证功能"

# ultrathink 模式 - 深度思考
"分析这个架构设计 ultrathink"

# 搜索模式
"搜索所有 API 路由"
"find authentication implementations"

# 分析模式
"分析这个项目的缓存机制"
```

#### 2. 调用特定 Agent

```bash
# 调用 oracle 架构审查
"Ask @oracle to review this architecture"

# 调用 librarian 查文档
"Ask @librarian how to implement React hooks"

# 调用 explore 探索代码
"Ask @explore to find all cache implementations"

# 调用 frontend-ui-ux-engineer
"Ask @frontend-ui-ux-engineer to design a dashboard"

# 调用 document-writer
"Ask @document-writer to write API documentation"
```

#### 3. 使用 Todo 系统

```bash
# agent 会自动创建和管理 todo
# 可以让 agent 继续未完成的任务
"Continue from where we left off"
"Check what todos are pending"
```

### 方式二：在项目目录中直接运行

```bash
cd /Users/xitongzhang/MyCursorProject/ai-hot-news-board
opencode
```

然后在 opencode 中给出任务指令。

---

## 实际使用示例

### 在 ai-hot-news-board 项目中使用

1. **分析项目架构**
   ```bash
   "分析这个项目的架构 ultrathink"
   ```
   - 深度分析架构，调用多个专家 agent
   - 识别潜在问题和改进点

2. **添加新功能**
   ```bash
   "添加用户认证功能 ultrawork"
   ```
   - Sisyphus 规划任务，分配给不同 agent
   - 持续执行直到功能完成
   - 自动处理 TODO 列表

3. **搜索特定实现**
   ```bash
   "搜索所有缓存相关代码"
   "Ask @explore to find all cache implementations"
   ```
   - explore agent 使用 LSP + Grep 快速查找
   - 上下文感知的代码搜索

4. **重构代码**
   ```bash
   "重构 server.js，使用更好的命名"
   ```
   - 使用 lsp_rename, lsp_code_actions 等工具
   - AST 感知的代码替换

5. **查询最佳实践**
   ```bash
   "搜索如何优化 Redis 性能"
   "Ask @librarian about Redis best practices"
   ```
   - 并行调用 websearch + context7 + grep_app
   - 综合多个来源的信息

6. **UI 开发**
   ```bash
   "Ask @frontend-ui-ux-engineer to design a dashboard component"
   ```
   - frontend agent 专注 UI/UX
   - 考虑响应式设计和用户体验

7. **代码审查**
   ```bash
   "Ask @oracle to review this pull request"
   ```
   - oracle 进行深度审查
   - 提供架构和最佳实践建议

---

## LSP 工具使用

### OpenCode 基础 LSP（分析用）
- `lsp_hover` - 查看类型信息和文档
- `lsp_goto_definition` - 跳转到定义
- `lsp_find_references` - 查找引用
- `lsp_document_symbols` - 文件符号大纲
- `lsp_workspace_symbols` - 跨项目搜索符号
- `lsp_diagnostics` - 获取错误和警告

### Oh-My-OpenCode 增强工具（重构用）
- `lsp_rename` - 重命名符号（跨项目）
- `lsp_code_actions` - 获取可用的快速修复
- `lsp_code_action_resolve` - 应用代码操作
- `ast_grep_search` - AST 感知的代码模式搜索（25 种语言）
- `ast_grep_replace` - AST 感知的代码替换

---

## 配置调整

编辑 `~/.config/opencode/oh-my-opencode.json`：

### 启用/禁用特定 Hooks

```jsonc
{
  "disabled_hooks": [
    "comment-checker",      // 注释检查器
    "agent-usage-reminder", // Agent 使用提醒
    "startup-toast"         // 启动通知
  ]
}
```

### 启用/禁用特定 MCPs

```jsonc
{
  "disabled_mcps": [
    "websearch",  // 网络搜索
    "context7",   // 官方文档
    "grep_app"    // GitHub 代码搜索
  ]
}
```

### 自定义 Agent 模型

```jsonc
{
  "agents": {
    "oracle": {
      "model": "anthropic/claude-opus-4-5"  // 如果你有 Claude
    },
    "explore": {
      "model": "anthropic/claude-haiku-4-5"  // 快速探索
    }
  }
}
```

### 配置背景任务并发

```jsonc
{
  "background_task": {
    "defaultConcurrency": 5,
    "providerConcurrency": {
      "anthropic": 3,
      "openai": 5,
      "google": 10
    }
  }
}
```

### 自定义 Categories

```jsonc
{
  "categories": {
    "data-science": {
      "model": "anthropic/claude-sonnet-4-5",
      "temperature": 0.2,
      "prompt_append": "Focus on data analysis, ML pipelines, and statistical methods."
    },
    "visual": {
      "model": "google/gemini-3-pro-high",
      "prompt_append": "Use shadcn/ui components and Tailwind CSS."
    }
  }
}
```

---

## 可用的 Hooks

| Hook 名称 | 功能 |
|----------|------|
| `todo-continuation-enforcer` | 强制 agent 完成所有 TODO |
| `context-window-monitor` | 上下文窗口监控（70%+ 提醒） |
| `session-recovery` | 会话自动恢复 |
| `session-notification` | 会话空闲时发送通知 |
| `comment-checker` | 检查并减少多余注释 |
| `grep-output-truncator` | 截断 grep 输出防止上下文溢出 |
| `tool-output-truncator` | 截断工具输出 |
| `directory-agents-injector` | 自动注入 AGENTS.md |
| `directory-readme-injector` | 自动注入 README.md |
| `empty-task-response-detector` | 检测空任务响应 |
| `think-mode` | 自动检测深度思考需求 |
| `anthropic-context-window-limit-recovery` | Claude 上下文限制恢复 |
| `rules-injector` | 注入自定义规则 |
| `background-notification` | 后台任务完成通知 |
| `auto-update-checker` | 自动更新检查 |
| `startup-toast` | 启动时显示通知 |
| `keyword-detector` | 关键字检测 |
| `agent-usage-reminder` | Agent 使用提醒 |
| `interactive-bash-session` | 交互式 bash 会话 |
| `empty-message-sanitizer` | 清理空消息 |
| `compaction-context-injector` | 压缩上下文注入 |
| `thinking-block-validator` | 思考块验证 |
| `claude-code-hooks` | Claude Code 兼容层 |
| `ralph-loop` | Ralph 循环 |
| `preemptive-compaction` | 预防性压缩 |

---

## Categories（领域分类）

### 默认 Categories

| Category | 模型 | 用途 |
|----------|------|------|
| `visual` | Gemini 3 Pro Preview | 前端、UI/UX、设计任务（创意度高） |
| `business-logic` | GPT 5.2 | 后端逻辑、架构、战略推理（创意度低） |

### 使用方式

```bash
# 通过 sisyphus_task 工具（agent 内部使用）
sisyphus_task(category="visual", prompt="Create a responsive dashboard component")
sisyphus_task(category="business-logic", prompt="Design the payment processing flow")

# 直接调用 agent
sisyphus_task(agent="oracle", prompt="Review this architecture")
```

---

## 常见命令

### 基础命令

```bash
# 启动 opencode
opencode

# 查看版本
opencode --version

# 认证提供商
opencode auth login

# 查看配置
cat ~/.config/opencode/opencode.json
cat ~/.config/opencode/oh-my-opencode.json
```

### 安装/更新

```bash
# 使用 bunx（推荐）
bunx oh-my-opencode install

# 使用 npx
npx oh-my-opencode install

# 更新全局安装
npm update -g oh-my-opencode
```

---

## 故障排查

### bun not found

```bash
# 重新添加到 PATH
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# 或重启终端使 ~/.zshrc 生效
exec /bin/zsh
```

### 插件未加载

```bash
# 检查配置文件
cat ~/.config/opencode/opencode.json

# 确保包含 "oh-my-opencode" 在 plugin 数组中
```

### 认证问题

- **国内 Google 账户**: 无法使用 antigravity OAuth，已配置为跳过
- **其他提供商**: 运行 `opencode auth login` 按提示操作

---

## 后续扩展

### 如需启用 Gemini

1. 获得海外 Google 账户
2. 安装 antigravity auth 插件：
   ```bash
   npm install -g opencode-antigravity-auth
   ```
3. 更新 `~/.config/opencode/opencode.json`：
   ```json
   {
     "plugin": [
       "oh-my-opencode",
       "opencode-antigravity-auth@1.2.8"
     ]
   }
   ```
4. 运行 `opencode auth login` 选择 Google → OAuth with Antigravity

### 添加更多模型

编辑 `~/.config/opencode/oh-my-opencode.json`，更新 agent 模型配置。

---

## 参考资源

- **Oh-My-OpenCode GitHub**: https://github.com/code-yeongyu/oh-my-opencode
- **OpenCode 文档**: https://opencode.ai/docs
- **Antigravity Auth**: https://github.com/NoeFabris/opencode-antigravity-auth

---

## 快速开始

```bash
# 进入项目目录
cd /Users/xitongzhang/MyCursorProject/ai-hot-news-board

# 启动 opencode
opencode

# 尝试以下命令：
# "分析这个项目的架构 ultrathink"
# "Ask @explore to find all API routes"
# "搜索如何优化 Node.js 性能"
```

---

**文档生成时间**: 2026-01-11  
**最后更新**: 2026-01-11
