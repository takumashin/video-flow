# Seedance Studio

仿照 Dify 工作流 Canvas 前端架构打造的 **AI 视频生成工具**，仅保留前端 + 轻量 API 代理，调用火山引擎 [Seedance 视频生成 API](https://www.volcengine.com/docs/82379/1520757)。

## 功能特性

- **可视化工作流画布**：基于 React Flow，参考 Dify 的节点连线交互
- **节点类型**：开始 → 文本提示词 →（可选）参考图片 → Seedance 生成 → 视频输出
- **Seedance 集成**：通过 Next.js API Route 代理火山方舟 API，API Key 不暴露到浏览器
- **参数配置**：宽高比、时长、音频、水印、镜头固定等
- **运行日志**：实时展示工作流执行状态

## 快速开始

### 1. 安装依赖

```bash
cd seedance-studio
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`，填入火山方舟 API Key 和模型 Endpoint ID：

```env
ARK_API_KEY=your_ark_api_key
ARK_MODEL=doubao-seedance-1-5-pro-251215
```

> 在 [火山方舟控制台](https://console.volcengine.com/ark) 创建推理接入点，开通 Seedance 视频生成模型。

### 3. 启动开发服务器

```bash
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)

## 使用说明

1. 画布默认包含一条示例工作流：**开始 → 文本提示词 → Seedance 生成 → 视频输出**
2. 点击节点，在右侧配置提示词和生成参数
3. 可选：添加「参考图片」节点并连接到 Seedance，实现图生视频
4. 点击「运行工作流」，等待 Seedance 生成完成
5. 在「视频输出」节点预览和下载结果

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 16 + React 19 + TypeScript |
| 画布 | React Flow（与 Dify 相同） |
| 状态 | Zustand |
| 样式 | Tailwind CSS 4 |
| API | 火山方舟 Seedance REST API |

## API 代理

| 端点 | 说明 |
|------|------|
| `POST /api/seedance/tasks` | 创建并轮询视频生成任务 |
| `GET /api/seedance/tasks/[id]` | 查询任务状态 |

## 项目结构

```
src/
├── app/                    # Next.js App Router + API Routes
├── components/
│   ├── canvas/             # 画布、节点、连线、操作栏
│   └── studio-header.tsx   # 顶部工具栏
├── lib/
│   ├── seedance.ts         # 火山引擎 API 封装
│   ├── workflow-engine.ts  # 工作流校验与执行逻辑
│   └── types.ts
└── store/
    └── workflow-store.ts   # 画布状态
```

## 与 Dify 的关系

本项目**仅参考 Dify 前端的 Canvas 交互模式**（React Flow 节点编排、MiniMap、缩放控制、节点配置面板），不包含 Dify 后端，是独立的 AI 视频生成工具。

## 注意事项

- 视频 URL 约 24 小时后失效，请及时下载
- 图生视频时，图片 URL 需公网可访问
- 生成耗时较长（通常 1–5 分钟），请耐心等待
