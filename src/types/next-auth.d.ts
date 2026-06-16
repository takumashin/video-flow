import type { DefaultSession } from 'next-auth'
import type { WorkspaceRole } from '@/db/schema'

declare module 'next-auth' {
  interface Session {
    activeWorkspaceId: string | null
    activeWorkspaceRole: WorkspaceRole | null
    activeWorkspaceName: string | null
    needsAccountBinding: boolean
    emailVerified: string | null
    user: {
      id: string
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    activeWorkspaceId?: string | null
    activeWorkspaceRole?: WorkspaceRole | null
    activeWorkspaceName?: string | null
    needsAccountBinding?: boolean
    emailVerified?: string | null
  }
}
