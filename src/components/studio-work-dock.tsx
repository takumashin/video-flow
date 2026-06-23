'use client'

import AddBlockPanel from '@/components/canvas/add-block-panel'
import { RunLogToggle } from '@/components/canvas/run-log-panel'
import AccountBalance from '@/components/account-balance'
import UserCredits from '@/components/user-credits'
import ThemeToggle from '@/components/theme-toggle'
import UserMenu from '@/components/user-menu'

export default function StudioWorkDock() {
  return (
    <div className="relative z-30 flex shrink-0 items-center justify-between gap-3 border-t border-border bg-surface/95 px-3 py-2 backdrop-blur-sm">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <AddBlockPanel compact menuPlacement="above" />
        <RunLogToggle />
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <UserCredits compact menuPlacement="above" />
        <AccountBalance compact menuPlacement="above" />
        <ThemeToggle compact />
        <UserMenu compact />
      </div>
    </div>
  )
}
