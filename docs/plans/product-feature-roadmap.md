# Seedance Studio 产品功能路线图

> 日期：2026-06-16  
> 状态：待执行  
> 分支基准：`feature/userSystem`  
> 范围说明：**不含** 上云 PostgreSQL、对象存储（TOS/S3）、纯 DevOps/部署类工作

---

## 1. 文档目的

本文档汇总当前代码库相对完整 Studio 产品的功能遗漏，并按 **Phase A → D** 组织为可逐项执行的开发计划。每个 Phase 包含：

- 目标与优先级
- 任务清单（可勾选）
- 验收标准（UAT）
- 主要涉及模块
- 依赖关系

执行建议：**按 Phase 顺序推进**；Phase 内任务可并行，但应优先完成 P0 项再进入下一 Phase。

---

## 2. 当前基线（已实现，不再重复开发）

| 模块 | 已实现能力 |
|------|-----------|
| 认证 | 邮箱密码、微信/微博/飞书 OAuth、注册、忘记/重置密码、邮箱验证、账号绑定 |
| Workspace | 多空间、切换、重命名/删除、成员列表、飞书邀请链接（单链接、重新生成作废旧链） |
| 工作流 | React Flow 画布、多 Tab、自动保存、JSON 导入导出、revision 乐观锁 |
| Seedance | 单节点生成、任务队列、全站并发排队、按模型扣点、节点排队文案、取消生成（火山 DELETE API） |
| 协作 | WebSocket 在线成员、已保存工作流实时同步、冲突弹窗 |
| 点数 | 用户余额、消耗记录、审查失败/排队提交失败退点、管理员充值（`/admin/credits`） |
| 资产 | 图片/视频/音频上传、资产库侧边栏、拖拽到画布 |

---

## 3. Phase 总览

| Phase | 主题 | 优先级 | 预期价值 |
|-------|------|--------|----------|
| **A** | 生成体验闭环 | P0 | 任务可取消、失败可退点、画布与队列状态一致、支持整流运行 |
| **B** | 商业化与点数 | P0–P1 | 用户自助充值、订单记录、可选 Workspace 点数池 |
| **C** | 协作与团队 | P1 | 成员角色 UI、协作体验增强、生产级 WS |
| **D** | 内容与运营 | P2 | 统一作品库、通知、管理后台、限流与审计 |

---

## Phase A — 生成体验闭环（P0）

**目标**：让用户「提交 → 排队 → 生成 → 完成/失败/取消」全链路可控，画布状态与任务队列一致，并支持基础的一键运行。

### A.1 取消生成

- [x] **A.1.1** Seedance 节点增加「取消生成」按钮（生成中可见）
- [x] **A.1.2** 调用现有 `AbortController` 中断客户端轮询
- [x] **A.1.3** 服务端标记任务为 `cancelled`（`DELETE /api/seedance/tasks/[id]`）
- [x] **A.1.4** 调用火山 [DELETE 取消/删除任务 API](https://www.volcengine.com/docs/82379/1521720)（`queued` 可取消；`running` 不支持远程取消，返回 409）
- [x] **A.1.5** 取消后释放全站排队槽位（`scheduleSeedanceQueueProcessing`）
- [x] **A.1.6** 任务队列面板支持取消操作（waiting / submitting / queued）

**涉及文件（参考）**  
`src/components/canvas/seedance-node-panel.tsx`、`src/lib/seedance-generation-control.ts`、`src/lib/seedance.ts`、`src/lib/run-workflow-session.ts`、`src/app/api/seedance/tasks/[id]/route.ts`、`src/lib/seedance-task/service.ts`、`src/lib/seedance-queue/service.ts`

**验收标准**

- 生成中点击取消，节点回到 idle，队列状态变为 cancelled
- 取消后其他 waiting 任务能在合理时间内被调度
- 刷新页面后 cancelled 状态与服务器一致
- `running` 状态任务取消时提示「正在生成中的任务无法取消」

---

### A.2 生成失败自动退点

> **产品决策（Phase A）**：仅以下场景退点，其余 failed / cancelled **不退**。详见 `src/lib/credits/refund-policy.ts`。

- [x] **A.2.1** 内容审查 / 安全策略 failed → `refundCreditsForReviewFailedTask`（幂等）
- [x] **A.2.2** 系统排队提交失败 → `refundCreditsForTask`（幂等，`hasCreditRefundForTask`）
- [x] **A.2.3** 在 `syncSeedanceTaskRecordFromApi` 检测到审查类 failed 时退点
- [x] **A.2.4** 用户取消（cancelled）**不退点**；一般 API failed（非审查）**不退点**
- [x] **A.2.5** 退点后客户端通过 `notifyCreditsChanged` 刷新底栏 / 账户页点数

**涉及文件**  
`src/lib/credits/service.ts`、`src/lib/credits/refund-policy.ts`、`src/lib/seedance-task/service.ts`、`src/lib/seedance-queue/service.ts`

**验收标准**

- 模拟审查类 failed 后，用户余额恢复扣点数量
- 排队提交失败后，用户余额恢复扣点数量
- 一般 failed / cancelled 不退点
- 同一 taskId 多次 sync 不会重复退点
- 交易记录中可见 refund 条目

---

### A.3 画布与任务状态恢复

- [ ] **A.3.1** 保存工作流时保留「进行中任务」所需字段（或仅存 taskId + 由 reconcile 恢复）
- [ ] **A.3.2** 页面加载 / 切换工作流时 `reconcileActiveTasks` 覆盖 waiting/submitting/queued/running
- [ ] **A.3.3** 节点展示 `taskStatus` / `queuePosition`（waiting 文案已有，需与 reconcile 对齐）
- [ ] **A.3.4** 任务队列「恢复」与工作流节点双向一致（同一 taskId）
- [ ] **A.3.5** 修复 sanitize 清状态导致的「队列有任务、节点 idle」问题

**涉及文件**  
`src/lib/sanitize-workflow.ts`、`src/store/workflow-store.ts`、`src/components/task-queue-bootstrap.tsx`、`src/lib/run-workflow-session.ts`

**验收标准**

- 生成中刷新页面，节点仍显示排队/生成中，并最终完成
- 从任务队列点恢复，画布对应节点状态正确
- 保存工作流不会丢失进行中的 taskId（或保存后仍能 reconcile）

---

### A.4 一键运行工作流（串行为先）

- [ ] **A.4.1** 顶栏或画布增加「运行工作流」入口
- [ ] **A.4.2** 使用 `topologicalOrder` 找出所有 Seedance 节点执行顺序
- [ ] **A.4.3** 串行执行：上一节点 succeeded 再跑下一个；失败则停止并写日志
- [ ] **A.4.4** 运行中禁用重复触发；支持整体 Abort（串联 A.1）
- [ ] **A.4.5** 运行日志面板展示整流进度（已有 RunLog 可扩展）

**涉及文件**  
`src/lib/workflow-engine.ts`、新建 `src/lib/run-workflow-all.ts` 或扩展 `run-workflow-session.ts`、`src/components/studio-header.tsx`

**验收标准**

- 含 2+ Seedance 节点的工作流可一键串行跑通
- 任一节点校验失败时整流不启动并提示原因
- 与单节点「生成视频」行为不冲突

---

### Phase A 完成定义

- [ ] 取消、失败退点、状态恢复、串行整流 4 项 UAT 通过
- [ ] `pnpm build` 通过
- [ ] 更新 README 中「运行工作流」描述（与 A.4 一致）

---

## Phase B — 商业化与点数（P0–P1）

**目标**：用户可自助充值，点数变动可追溯；可选支持 Workspace 级点数池。

### B.1 用户自助充值（支付网关）

- [ ] **B.1.1** 选定支付渠道（微信/支付宝/Stripe 等）与计费模型（点数包）
- [ ] **B.1.2** Schema：`payment_order` 或扩展 `credit_transaction` 关联订单号
- [ ] **B.1.3** API：创建订单、支付回调、查询订单状态
- [ ] **B.1.4** UI：账户页「充值」入口、套餐选择、支付结果页
- [ ] **B.1.5** 支付成功幂等入账（防重复回调）

**验收标准**

- 测试环境完成一笔充值全流程，余额增加且有一条 recharge 记录
- 重复回调不会重复加点

---

### B.2 用户侧充值与消耗记录

- [ ] **B.2.1** 账户页展示完整点数流水（分页）
- [ ] **B.2.2** 筛选：充值 / 消耗 / 退还
- [ ] **B.2.3** 底栏 `UserCredits` Popover 链到账户页流水

**验收标准**

- 用户可查看最近 30 天所有点数变动及关联 taskId（如有）

---

### B.3 生成前余额校验与提示

- [ ] **B.3.1** 节点/模型选择器展示本次消耗（已有部分）
- [ ] **B.3.2** 提交前明确提示「将消耗 N 点，当前余额 M 点」
- [ ] **B.3.3** 余额不足时禁用生成并引导充值

---

### B.4（可选）Workspace 点数池

- [ ] **B.4.1** Schema：`workspace_credits` 或 workspace 级 balance
- [ ] **B.4.2** 扣点从 Workspace 池扣除，而非个人余额
- [ ] **B.4.3** Owner/Admin 为空间充值；Member 仅消耗
- [ ] **B.4.4** 迁移策略：现有 `user_credits` 与空间池并存或一次性迁移

**说明**：B.4 与 B.1 可二选一先行；若只做个人点数，可跳过 B.4。

---

### Phase B 完成定义

- [ ] 至少一种支付方式上线（或沙箱）
- [ ] 用户可自助充值并看到订单/流水
- [ ] 管理员充值路径保留且与新系统不冲突

---

## Phase C — 协作与团队（P1）

**目标**：团队可管理成员权限；协作从「能用」到「好用」；生产环境可部署 WS。

### C.1 Workspace 成员管理 UI

- [ ] **C.1.1** 设置中支持修改成员角色（admin/member），调用已有 PATCH API
- [ ] **C.1.2** Owner 转移（新 API + 确认流程）
- [ ] **C.1.3** Member 权限说明（只读文案：谁能邀请、谁能删空间等）

**验收标准**

- Owner 可将 member 提升为 admin；admin 不能删 workspace

---

### C.2 邀请能力扩展（可选）

- [ ] **C.2.1** 邮箱邀请（schema 已有，补 UI + 发信）
- [ ] **C.2.2** 指定飞书用户邀请（feishuOpenId 定向链接）

---

### C.3 实时协作增强

- [ ] **C.3.1** 未保存工作流：首次保存后自动 join WS，或临时 room id
- [ ] **C.3.2** 协作者光标/选中节点广播（protocol 扩展）
- [ ] **C.3.3** 节点编辑锁（可选，防止两人改同一 Seedance 参数）
- [ ] **C.3.4** 冲突处理：remote_edit 三选一（保留本地 / 使用远端 / 稍后）已有，可评估 diff 预览

**涉及文件**  
`server/workflow-sync-server.ts`、`src/lib/workflow-sync/protocol.ts`、`src/components/workflow-collaboration.tsx`

---

### C.4 生产 WebSocket 部署

- [ ] **C.4.1** 文档：`NEXT_PUBLIC_WORKFLOW_WS_URL` 生产 wss 配置
- [ ] **C.4.2** 与 Next 同域反代或独立 WS 服务进程
- [ ] **C.4.3** 健康检查、断线重连策略验证（生产环境）

**验收标准**

- 两名用户在不同网络下同时编辑同一已保存工作流，改动可见、冲突可处理

---

### Phase C 完成定义

- [ ] 成员角色 UI + 至少一项协作增强（C.3.1 或 C.3.2）
- [ ] 生产 WS 部署文档与一次联调验证

---

## Phase D — 内容与运营（P2）

**目标**：作品可统一管理；用户得到任务反馈；运营可观测与管控。

### D.1 统一作品库

- [ ] **D.1.1** 聚合：任务队列成功项、Seedance 节点 history、资产库视频
- [ ] **D.1.2** 列表：搜索、按时间/工作流/模型筛选
- [ ] **D.1.3** 批量下载、删除、复制链接
- [ ] **D.1.4** 远程 URL 即将过期提醒与「保存到本地」重试

---

### D.2 通知

- [ ] **D.2.1** 站内：任务 succeeded/failed  toast 或通知中心
- [ ] **D.2.2**（可选）邮件/飞书 webhook：生成完成
- [ ] **D.2.3** 用户通知偏好设置

---

### D.3 管理后台扩展

- [ ] **D.3.1** 用户列表、Workspace 列表
- [ ] **D.3.2** 全站 Seedance 队列监控（active/waiting/availableSlots）
- [ ] **D.3.3** 失败率、消耗统计（按日/模型）
- [ ] **D.3.4** 操作审计日志（充值、删空间、改角色）

---

### D.4 限流与安全

- [ ] **D.4.1** Per-user 并发上限（在全局排队之上）
- [ ] **D.4.2** Per-workspace 日消耗上限（可选）
- [ ] **D.4.3** 上传大小/类型策略与环境变量文档

---

### D.5 工作流产品化

- [ ] **D.5.1** 工作流历史版本列表与回滚
- [ ] **D.5.2** .duplicate / 另存为
- [ ] **D.5.3** 官方模板库（2–3 个示例工作流）
- [ ] **D.5.4** 清理 Start/Output 遗留类型与 README 对齐

---

### D.6 账号体系完善

- [ ] **D.6.1** OAuth 与邮箱账号合并（同邮箱绑定）
- [ ] **D.6.2** 登录会话列表与踢下线（可选）
- [ ] **D.6.3** 2FA（可选，低优先级）

---

### Phase D 完成定义

- [ ] 作品库 MVP 可用
- [ ] 任务完成至少有站内通知
- [ ] Admin 可查看队列与基础统计

---

## 4. 跨 Phase 技术债（建议穿插处理）

| 项 | 说明 | 建议插入 Phase |
|----|------|----------------|
| README 过时 | 仍描述旧 Start/Output、运行工作流 | A 末尾 |
| 自动化测试 | auth、扣点、排队、退点 | A.2 后 |
| 错误 UX 统一 | 429、余额不足、排队超时 | A 末尾 |
| `generated_video` / `asset` 元数据一致性 | 删除文件时同步 DB | D.1 |

---

## 5. 明确不在本路线图内

以下事项 **刻意排除**，需单独立项：

- PostgreSQL / Redis 上云与托管切换
- 对象存储 TOS/S3 与 CDN
- K8s、CI/CD、监控告警平台搭建
- 火山账号多 Key 负载均衡（除非 Phase D 限流需要）

---

## 6. 执行与跟踪建议

1. **每个 Phase 开独立分支**：`feature/phase-a-generation`、`feature/phase-b-billing` 等  
2. **每个子任务完成后打勾**本文档对应 checkbox  
3. **Phase 结束前跑 UAT**：按各节「验收标准」手工或脚本验证  
4. **Phase 完成后**在本文件顶部更新「状态」与完成日期  

---

## 7. 附录：关键代码路径索引

| 领域 | 路径 |
|------|------|
| Seedance 任务 API | `src/app/api/seedance/tasks/` |
| 排队 | `src/lib/seedance-queue/` |
| 扣点/退点 | `src/lib/credits/service.ts` |
| 单节点运行 | `src/lib/run-workflow-session.ts` |
| 工作流引擎 | `src/lib/workflow-engine.ts` |
| 协作 WS | `server/workflow-sync-server.ts` |
| Workspace 成员 | `src/lib/workspace/members.ts` |
| 设置 UI | `src/components/workspace-settings-dialog.tsx` |
| 账户/点数 UI | `src/app/account/page.tsx`、`src/app/admin/credits/` |

---

*文档版本：1.0 · 生成自 2026-06-16 功能遗漏梳理*
