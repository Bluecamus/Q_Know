# 言知 Q-Know

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> 面向儿童的 AI 故事复述诊断助手 —— 孩子讲故事，AI 来倾听、反馈与鼓励。

言知 Q-Know 是一个为低龄儿童设计的对话式 Web 应用。孩子把读过的故事用自己的话复述出来，AI 基于 Dify 平台上的知识库（RAG）对复述内容进行理解与诊断，以温和、鼓励的方式给出反馈，帮助孩子提升语言表达与叙事能力。

## 功能特性

- **流式对话**：基于 SSE（Server-Sent Events）的逐字流式输出，回复即时可见
- **Markdown 渲染**：AI 回复支持标题、加粗、列表、表格等富文本格式（react-markdown + remark-gfm）
- **彩蛋激励**：当 AI 回复中出现 `VICTORY` 关键词时，自动播放音效并触发全屏撒花庆祝动画，给孩子正向激励
- **儿童友好 UI**：大字号、圆角气泡、高对比配色，专为儿童阅读优化

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 框架 | Next.js 14（App Router）+ React 18 + TypeScript |
| 样式 | Tailwind CSS 3 |
| AI 能力 | Dify（RAG 知识库 + 对话编排），通过官方 Chat Messages API 接入 |
| 渲染增强 | react-markdown、remark-gfm |

## 架构说明

```
浏览器（React 聊天界面）
    │  POST /api/chat  { query }
    ▼
Next.js API Route（app/api/chat/route.ts）
    │  服务端读取 DIFY_API_KEY，转发至 Dify
    │  response_mode: streaming
    ▼
Dify Chat Messages API（RAG 检索 + LLM 生成）
    │  SSE 流式分片
    ▼
API Route 原样透传 → 前端逐片解析 data: 行，增量渲染
```

安全要点：**API Key 只存在于服务端环境变量中**，浏览器永远接触不到；前端仅与本项目的 `/api/chat` 通信。

## 本地运行

前置要求：Node.js 18+

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入你在 Dify 平台获取的真实 API Key

# 3. 启动开发服务器
npm run dev
```

打开 http://localhost:3000 即可使用。

## 环境变量

| 变量 | 说明 | 获取方式 |
| --- | --- | --- |
| `DIFY_API_KEY` | Dify 应用的 API 密钥 | Dify 控制台 → 应用 → 访问 API → 生成密钥 |

`.env.local` 已在 `.gitignore` 中排除，不会被提交到仓库。

## 目录结构

```
├── app/
│   ├── api/chat/route.ts   # Dify 代理接口（SSE 透传）
│   ├── page.tsx            # 聊天主界面（流式渲染 / Markdown / 彩蛋）
│   ├── globals.css         # 全局样式 + Markdown 气泡样式 + 撒花动画
│   └── layout.tsx
├── public/victory.mp3      # 庆祝音效
├── .env.example            # 环境变量模板
└── package.json
```

## License

MIT
