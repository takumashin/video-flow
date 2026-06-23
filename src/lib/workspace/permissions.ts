import type { WorkspaceRole } from '@/db/schema'

const ROLE_RANK: Record<WorkspaceRole, number> = {
  member: 1,
  admin: 2,
  owner: 3,
}

export function hasMinRole(role: WorkspaceRole, minRole: WorkspaceRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole]
}

export type WorkspacePermission =
  | 'view'
  | 'edit_content'
  | 'invite_members'
  | 'manage_members'
  | 'rename_workspace'
  | 'delete_workspace'

const PERMISSION_MIN_ROLE: Record<WorkspacePermission, WorkspaceRole> = {
  view: 'member',
  edit_content: 'member',
  invite_members: 'admin',
  manage_members: 'admin',
  rename_workspace: 'admin',
  delete_workspace: 'owner',
}

export function canPerform(role: WorkspaceRole, permission: WorkspacePermission): boolean {
  return hasMinRole(role, PERMISSION_MIN_ROLE[permission])
}

export function getRoleLabel(role: WorkspaceRole): string {
  switch (role) {
    case 'owner':
      return '所有者'
    case 'admin':
      return '管理员'
    case 'member':
      return '成员'
  }
}

export function assertPermission(role: WorkspaceRole, permission: WorkspacePermission): void {
  if (!canPerform(role, permission))
    throw new Error('当前角色无权执行此操作')
}
