import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import type { WorkflowEdge, WorkflowNode, WorkflowVersionType } from '@/lib/types'

export const users = pgTable('user', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
  passwordHash: text('passwordHash'),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
})

export type CreditTransactionType =
  | 'signup_bonus'
  | 'video_generation'
  | 'recharge'
  | 'refund'
  | 'adjustment'

export const userCredits = pgTable('user_credits', {
  userId: text('userId')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  balance: integer('balance').notNull().default(0),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
})

export const creditTransactions = pgTable('credit_transaction', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  balanceAfter: integer('balanceAfter').notNull(),
  type: text('type').$type<CreditTransactionType>().notNull(),
  model: text('model'),
  taskId: text('taskId'),
  description: text('description'),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
})

export const accounts = pgTable(
  'account',
  {
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  account => ({
    compositePk: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
)

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
})

export const verificationTokens = pgTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  verificationToken => ({
    compositePk: primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  }),
)

export const workspaces = pgTable(
  'workspace',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  table => ({
    slugIdx: uniqueIndex('workspace_slug_idx').on(table.slug),
  }),
)

export const userPreferences = pgTable('user_preferences', {
  userId: text('userId')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  activeWorkspaceId: text('activeWorkspaceId').references(() => workspaces.id, {
    onDelete: 'set null',
  }),
  lastWorkflowIds: jsonb('lastWorkflowIds')
    .$type<Record<string, string>>()
    .notNull()
    .default({}),
})

export type WorkspaceRole = 'owner' | 'admin' | 'member'

export const workspaceMembers = pgTable(
  'workspace_member',
  {
    workspaceId: text('workspaceId')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').$type<WorkspaceRole>().notNull(),
    joinedAt: timestamp('joinedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  table => ({
    pk: primaryKey({ columns: [table.workspaceId, table.userId] }),
  }),
)

export type WorkspaceInviteChannel = 'email' | 'feishu'

export const workspaceInvites = pgTable(
  'workspace_invite',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspaceId')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    inviteChannel: text('inviteChannel').$type<WorkspaceInviteChannel>().notNull().default('email'),
    email: text('email'),
    feishuOpenId: text('feishuOpenId'),
    feishuUnionId: text('feishuUnionId'),
    displayName: text('displayName'),
    role: text('role').$type<'admin' | 'member'>().notNull(),
    token: text('token').notNull().unique(),
    invitedBy: text('invitedBy')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expiresAt', { mode: 'date' }).notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  },
  table => ({
    workspaceEmailIdx: uniqueIndex('workspace_invite_workspace_email_idx').on(
      table.workspaceId,
      table.email,
    ),
    workspaceFeishuIdx: uniqueIndex('workspace_invite_workspace_feishu_idx').on(
      table.workspaceId,
      table.feishuOpenId,
    ),
  }),
)

export const workflows = pgTable('workflow', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text('workspaceId')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  nodes: jsonb('nodes').$type<WorkflowNode[]>().notNull().default([]),
  edges: jsonb('edges').$type<WorkflowEdge[]>().notNull().default([]),
  revision: integer('revision').notNull().default(1),
  createdBy: text('createdBy').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
})

export type WorkflowBranchStatus = 'active' | 'archived' | 'merged'

export const workflowBranches = pgTable(
  'workflow_branch',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workflowId: text('workflowId')
      .notNull()
      .references(() => workflows.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    status: text('status').$type<WorkflowBranchStatus>().notNull().default('active'),
    description: text('description'),
    sourceVersionId: text('sourceVersionId'),
    createdBy: text('createdBy').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
    archivedAt: timestamp('archivedAt', { mode: 'date' }),
    mergedAt: timestamp('mergedAt', { mode: 'date' }),
  },
  table => ({
    workflowNameIdx: uniqueIndex('workflow_branch_workflow_name_idx').on(
      table.workflowId,
      table.name,
    ),
  }),
)

export const workflowVersions = pgTable(
  'workflow_version',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workflowId: text('workflowId')
      .notNull()
      .references(() => workflows.id, { onDelete: 'cascade' }),
    revision: integer('revision').notNull(),
    branchName: text('branchName').notNull().default('main'),
    nodes: jsonb('nodes').$type<WorkflowNode[]>().notNull(),
    edges: jsonb('edges').$type<WorkflowEdge[]>().notNull(),
    name: text('name').notNull(),
    label: text('label'),
    description: text('description'),
    type: text('type').$type<WorkflowVersionType>().notNull().default('auto'),
    createdBy: text('createdBy').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  },
  table => ({
    branchRevisionIdx: index('workflow_version_branch_revision_idx').on(
      table.workflowId,
      table.branchName,
      table.revision.desc(),
    ),
    branchCreatedIdx: index('workflow_version_branch_created_idx').on(
      table.workflowId,
      table.branchName,
      table.createdAt.desc(),
    ),
  }),
)

export type AssetKind = 'image' | 'video' | 'audio'

export const assetFolders = pgTable(
  'asset_folder',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspaceId')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  table => ({
    workspaceNameIdx: uniqueIndex('asset_folder_workspace_name_idx').on(
      table.workspaceId,
      table.name,
    ),
  }),
)

export const assets = pgTable('asset', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text('workspaceId')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  folderId: text('folderId').references(() => assetFolders.id, { onDelete: 'set null' }),
  kind: text('kind').$type<AssetKind>().notNull(),
  filename: text('filename').notNull(),
  storagePath: text('storagePath').notNull(),
  mimeType: text('mimeType').notNull(),
  size: bigint('size', { mode: 'number' }).notNull(),
  uploadedBy: text('uploadedBy').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
})

export const seedanceTasks = pgTable(
  'seedance_task',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: text('workspaceId')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    taskId: text('taskId').notNull(),
    apiTaskId: text('apiTaskId'),
    submitPayload: jsonb('submitPayload'),
    prompt: text('prompt'),
    nodeTitle: text('nodeTitle'),
    workflowId: text('workflowId'),
    nodeId: text('nodeId'),
    model: text('model'),
    status: text('status').notNull().default('queued'),
    progress: integer('progress'),
    videoUrl: text('videoUrl'),
    remoteVideoUrl: text('remoteVideoUrl'),
    errorMessage: text('errorMessage'),
    progressStartedAt: bigint('progressStartedAt', { mode: 'number' }),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  table => ({
    userTaskIdx: uniqueIndex('seedance_task_user_task_idx').on(table.userId, table.taskId),
  }),
)

export const generatedVideos = pgTable('generated_video', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text('workspaceId')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  storagePath: text('storagePath').notNull(),
  sourceTaskId: text('sourceTaskId'),
  mimeType: text('mimeType').notNull().default('video/mp4'),
  size: bigint('size', { mode: 'number' }),
  createdBy: text('createdBy').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
})
