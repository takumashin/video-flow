# Seedance Studio 用户系统 & PostgreSQL 设计

> 日期：2026-06-16  
> 状态：待评审  
> 分支：`feature/userSystem`

## 背景

Seedance Studio 当前为单机无用户模式：

- 工作流：`data/workflows/*.json` + 浏览器 localStorage
- 资产库：`data/uploads/` 本地文件
- 生成视频：`data/videos/` 本地文件
- 无登录、无数据隔离

目标：使用 **PostgreSQL** 构建完整用户系统，Phase 1 实现登录、多 Workspace 隔离、工作流与资产库持久化。

## 需求摘要（已确认）

| 项 | 决策 |
|---|---|
| 数据库 | PostgreSQL |
| ORM | Drizzle ORM（推荐，轻量、类型安全、有 Auth.js adapter） |
| 认证框架 | Auth.js v5 |
| 登录方式 | 邮箱 + 密码 **+ 微信 + 微博** |
| 登录策略 | **必须登录**才能使用 Studio |
| 租户模型 | **完整多 Workspace**（类似 Dify Workspace） |
| 注册行为 | 自动创建个人 Workspace |
| Workspace | **支持创建多个 + 切换** |
| 文件存储 | Phase 1 本地磁盘，DB 存元数据；后续可迁移 TOS/S3 |

## 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js 16 App                        │
├──────────────┬──────────────────┬───────────────────────┤
│  Middleware  │   Auth.js v5     │   Drizzle ORM         │
│  (登录保护)   │   Session/Cookie │   PostgreSQL          │
├──────────────┴──────────────────┴───────────────────────┤
│  API Routes（带 workspace 上下文）                        │
│  /api/workflows  /api/uploads  /api/videos  /api/ws...  │
├─────────────────────────────────────────────────────────┤
│  本地文件存储                                             │
│  data/uploads/{workspaceId}/...                         │
│  data/videos/{workspaceId}/...                          │
└─────────────────────────────────────────────────────────┘
```

## 认证设计

### 登录方式

#### 1. 邮箱 + 密码

- 注册页：邮箱、密码、确认密码、显示名（可选）
- 密码使用 bcrypt 哈希存储
- 邮箱验证：Phase 1 可选（建议预留 `email_verified` 字段，验证邮件 Phase 2）

#### 2. 微信登录（网站应用）

- 平台：[微信开放平台](https://open.weixin.qq.com/) → 网站应用
- 流程：OAuth 2.0 authorization_code，`scope=snsapi_login`
- PC 端：内嵌二维码（`wxLogin.js`）或跳转授权页
- 授权 URL：`https://open.weixin.qq.com/connect/qrconnect?...`
- Token：`GET https://api.weixin.qq.com/sns/oauth2/access_token`
- 用户信息：`GET https://api.weixin.qq.com/sns/userinfo`
- 用户标识：`unionid`（优先）或 `openid`
- **注意**：微信不返回邮箱；OAuth 用户 `email` 可为空或使用占位符 `wechat_{unionid}@oauth.local`

#### 3. 微博登录

- 平台：[微博开放平台](https://open.weibo.com/) → 网页应用
- 流程：标准 OAuth 2.0
- 授权 URL：`https://api.weibo.com/oauth2/authorize`
- Token：`POST https://api.weibo.com/oauth2/access_token`
- 用户信息：`GET https://api.weibo.com/2/users/show.json`
- 用户标识：`uid`
- **注意**：微博通常不返回邮箱；占位符 `weibo_{uid}@oauth.local`

### Auth.js 自定义 Provider

微信、微博均通过 Auth.js **自定义 OAuth Provider** 接入，配置项：

```env
# 通用
AUTH_SECRET=
AUTH_URL=https://your-domain.com          # 生产环境必填
DATABASE_URL=postgresql://...

# 邮箱密码（Credentials provider）
# 无额外 env

# 微信开放平台 - 网站应用
AUTH_WECHAT_APP_ID=
AUTH_WECHAT_APP_SECRET=

# 微博开放平台
AUTH_WEIBO_CLIENT_ID=
AUTH_WEIBO_CLIENT_SECRET=
```

### 账号关联策略

| 场景 | 处理 |
|---|---|
| OAuth 首次登录 | 创建 User + Account 记录 + 默认 Workspace |
| 同一邮箱已存在（邮箱注册后再 OAuth） | Phase 1：提示「该邮箱已注册，请用密码登录」；Phase 2 支持绑定 |
| 微信/微博重复登录 | 通过 `accounts.provider + providerAccountId` 匹配已有用户 |
| OAuth 用户无邮箱 | 使用占位 email + 要求用户后续绑定真实邮箱（Phase 2） |

### Session 扩展

Auth.js Session 扩展字段：

```typescript
interface Session {
  user: {
    id: string
    email: string
    name?: string
    image?: string
  }
  activeWorkspaceId: string
  activeWorkspaceRole: 'owner' | 'admin' | 'member'
}
```

`activeWorkspaceId` 存储在 `sessions` 表扩展列（或 `user_settings` 表），切换 Workspace 时更新。

## 多 Workspace 设计

### 概念

- **Workspace**：数据隔离边界，工作流、资产、生成视频均归属 Workspace
- **Member**：User 与 Workspace 的多对多关系，带角色
- 注册时自动创建默认 Workspace，名称如「{用户名} 的工作空间」

### 角色权限（Phase 1）

| 角色 | 读工作流/资产 | 写工作流/资产 | 管理成员 | 删除 Workspace |
|---|---|---|---|---|
| owner | ✅ | ✅ | ✅ | ✅ |
| admin | ✅ | ✅ | ✅ | ❌ |
| member | ✅ | ✅ | ❌ | ❌ |

Phase 1 成员邀请放 Phase 2；Schema 预留 `workspace_invites` 表。

### Workspace 切换

- 顶栏 Workspace 下拉：列出当前用户所有 Workspace
- 「创建工作空间」入口
- 切换调用 `POST /api/workspaces/active`，更新 Session 中的 `activeWorkspaceId`
- 切换后前端刷新工作流列表、资产库

### 创建 Workspace

```
POST /api/workspaces
{ "name": "新项目" }
→ 创建 workspace + workspace_members(owner) + 返回 workspace
```

## 数据库 Schema

### Auth.js 标准表（Drizzle adapter）

```sql
-- users
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
name          TEXT
email         TEXT UNIQUE NOT NULL
email_verified TIMESTAMPTZ
image         TEXT
password_hash TEXT          -- 仅 Credentials 用户有值
created_at    TIMESTAMPTZ DEFAULT now()
updated_at    TIMESTAMPTZ DEFAULT now()

-- accounts (OAuth)
user_id               UUID REFERENCES users(id) ON DELETE CASCADE
type                  TEXT
provider              TEXT    -- 'credentials' | 'wechat' | 'weibo'
provider_account_id   TEXT
refresh_token         TEXT
access_token          TEXT
expires_at            INTEGER
token_type            TEXT
scope                 TEXT
id_token              TEXT
session_state         TEXT
PRIMARY KEY (provider, provider_account_id)

-- sessions
session_token   TEXT PRIMARY KEY
user_id         UUID REFERENCES users(id) ON DELETE CASCADE
expires         TIMESTAMPTZ NOT NULL
active_workspace_id UUID REFERENCES workspaces(id)  -- 扩展字段

-- verification_tokens (邮箱验证，Phase 2)
identifier  TEXT
token       TEXT
expires     TIMESTAMPTZ
PRIMARY KEY (identifier, token)
```

### 业务表

```sql
-- workspaces
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
name        TEXT NOT NULL
slug        TEXT UNIQUE NOT NULL   -- URL 友好标识，自动生成
created_at  TIMESTAMPTZ DEFAULT now()
updated_at  TIMESTAMPTZ DEFAULT now()

-- workspace_members
workspace_id  UUID REFERENCES workspaces(id) ON DELETE CASCADE
user_id       UUID REFERENCES users(id) ON DELETE CASCADE
role          TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member'))
joined_at     TIMESTAMPTZ DEFAULT now()
PRIMARY KEY (workspace_id, user_id)

-- workflows
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
name          TEXT NOT NULL
nodes         JSONB NOT NULL DEFAULT '[]'
edges         JSONB NOT NULL DEFAULT '[]'
created_by    UUID REFERENCES users(id) ON DELETE SET NULL
created_at    TIMESTAMPTZ DEFAULT now()
updated_at    TIMESTAMPTZ DEFAULT now()

CREATE INDEX idx_workflows_workspace ON workflows(workspace_id, updated_at DESC);

-- assets（资产库元数据）
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
kind          TEXT NOT NULL CHECK (kind IN ('image', 'video', 'audio'))
filename      TEXT NOT NULL          -- 磁盘文件名
storage_path  TEXT NOT NULL          -- 相对路径 uploads/{workspaceId}/{filename}
mime_type     TEXT NOT NULL
size          BIGINT NOT NULL
uploaded_by   UUID REFERENCES users(id) ON DELETE SET NULL
created_at    TIMESTAMPTZ DEFAULT now()

CREATE INDEX idx_assets_workspace ON assets(workspace_id, created_at DESC);

-- generated_videos（Seedance 生成结果）
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
filename      TEXT NOT NULL
storage_path  TEXT NOT NULL          -- videos/{workspaceId}/{filename}
source_task_id TEXT
mime_type     TEXT NOT NULL DEFAULT 'video/mp4'
size          BIGINT
created_by    UUID REFERENCES users(id) ON DELETE SET NULL
created_at    TIMESTAMPTZ DEFAULT now()

CREATE INDEX idx_videos_workspace ON generated_videos(workspace_id, created_at DESC);
```

## API 改造

### 新增

| 端点 | 说明 |
|---|---|
| `/api/auth/[...nextauth]` | Auth.js handlers |
| `GET /api/workspaces` | 列出当前用户的 Workspace |
| `POST /api/workspaces` | 创建 Workspace |
| `POST /api/workspaces/active` | 切换活跃 Workspace |
| `PATCH /api/workspaces/[id]` | 重命名 Workspace |
| `DELETE /api/workspaces/[id]` | 删除 Workspace（仅 owner） |

### 改造（加 workspace 隔离）

所有现有 API 从 Session 读取 `activeWorkspaceId`，查询/写入时强制 `workspace_id` 过滤：

| 端点 | 改动 |
|---|---|
| `GET/POST /api/workflows` | 按 workspace_id 隔离 |
| `GET/PATCH/DELETE /api/workflows/[id]` | 校验归属 |
| `GET/POST /api/uploads` | 文件存 `data/uploads/{workspaceId}/`，DB 写 assets 表 |
| `GET/DELETE /api/uploads/[id]` | 校验 assets.workspace_id |
| `GET/POST /api/videos` | 同上，generated_videos 表 |
| `GET /api/videos/[id]` | 校验归属 |

### 鉴权 Helper

```typescript
// lib/auth-context.ts
async function requireAuth(): Promise<{ userId, workspaceId, role }>
// 未登录 → 401
// 无 activeWorkspace → 400 或自动选第一个
// 非成员 → 403
```

## 前端改造

### 新增页面

| 路由 | 内容 |
|---|---|
| `/login` | 邮箱密码表单 + 微信二维码 + 微博登录按钮 |
| `/register` | 邮箱注册表单 |

### 改造组件

| 组件 | 改动 |
|---|---|
| `middleware.ts` | 未登录重定向 `/login`；已登录访问 `/login` 重定向 `/` |
| `studio-header.tsx` | 用户头像/名称、Workspace 切换器、退出登录 |
| `workflow-store.ts` | 移除 localStorage persist；画布状态仍内存保留，持久化走 API |
| `workflow-manager.tsx` | 调用带鉴权的 workflows API |
| `asset-library-sidebar.tsx` | 调用带鉴权的 uploads API |

### Workspace 切换器 UI

```
┌──────────────────────────────┐
│ [图标] 张三的工作空间  ▼      │
├──────────────────────────────┤
│ ✓ 张三的工作空间              │
│   品牌视频项目                │
│   测试环境                    │
├──────────────────────────────┤
│ + 创建工作空间                │
└──────────────────────────────┘
```

## 文件存储（Phase 1）

```
data/
├── uploads/
│   └── {workspaceId}/
│       └── {uuid}.jpg
└── videos/
    └── {workspaceId}/
        └── {uuid}.mp4
```

- 磁盘路径与 `assets.storage_path` / `generated_videos.storage_path` 对应
- Phase 3 抽象 `StorageAdapter` 接口，支持 TOS/S3 替换

## 开发环境注意事项

### 微信/微博 OAuth 本地调试

两者均要求 **redirect_uri 与开放平台注册域名一致**，本地开发需：

1. 使用 ngrok / Cloudflare Tunnel 暴露 `https://xxx.ngrok.io`
2. 在微信/微博开放平台配置回调地址：
   - `https://xxx.ngrok.io/api/auth/callback/wechat`
   - `https://xxx.ngrok.io/api/auth/callback/weibo`
3. `AUTH_URL` 设为 tunnel 地址

### 无 OAuth 凭证时的降级

开发环境若暂未申请微信/微博应用：

- 邮箱密码登录仍可用
- 登录页 OAuth 按钮根据 env 是否存在决定是否显示

## Phase 划分

### Phase 1（本次）

- [ ] PostgreSQL + Drizzle schema & 迁移
- [ ] Auth.js：邮箱密码 + 微信 + 微博
- [ ] 注册自动创建 Workspace
- [ ] 多 Workspace 创建 & 切换
- [ ] 工作流 API 改造（workspace 隔离）
- [ ] 资产库 API 改造（workspace 隔离）
- [ ] 生成视频 API 改造
- [ ] Middleware 登录保护
- [ ] 登录/注册页 + 顶栏 Workspace 切换器
- [ ] 移除 workflow localStorage 持久化

### Phase 2

- Workspace 成员邀请 & 角色管理
- 邮箱验证 & OAuth 账号绑定
- 用户级 / Workspace 级 API Key 配置

### Phase 3

- 存储抽象层（火山 TOS / S3）
- 数据迁移工具（旧 `data/` 目录 → 新结构）

## 不在 Phase 1 范围

- 团队成员邀请
- 邮箱验证邮件
- 对象存储
- 旧数据自动迁移（现有 `data/` 为全局数据，需手动处理或丢弃）
- 付费计划 / 配额

## 风险 & 缓解

| 风险 | 缓解 |
|---|---|
| 微信/微博应用审核周期长 | Phase 1 先完成邮箱登录 + 全链路；OAuth 按钮 env 控制 |
| 微信不返回邮箱 | 占位 email + Phase 2 绑定 |
| 本地 OAuth 调试困难 | 文档说明 tunnel 方案；提供 dev 跳过 OAuth 的 env 开关 |
| 大文件上传性能 | 保持流式写盘；DB 只写元数据 |

## 验收标准

1. 用户可通过邮箱注册/登录，自动获得个人 Workspace
2. 用户可通过微信/微博 OAuth 登录（配置凭证后）
3. 用户可创建多个 Workspace 并切换，数据互不干扰
4. 未登录访问 `/` 重定向到 `/login`
5. 工作流保存/加载按 active Workspace 隔离
6. 资产库上传/列表按 active Workspace 隔离
7. 生成视频按 active Workspace 隔离存储
