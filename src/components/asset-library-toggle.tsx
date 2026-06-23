'use client'

import { PanelLeftOpen } from 'lucide-react'
import { useAssetLibraryStore } from '@/store/asset-library-store'

export default function AssetLibraryToggle() {
  const toggle = useAssetLibraryStore(s => s.toggle)

  return (
    <button
      type="button"
      onClick={toggle}
      className="absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface/95 px-3 py-2 text-xs font-medium text-foreground shadow-md backdrop-blur-sm transition hover:bg-surface-muted"
    >
      <PanelLeftOpen className="h-4 w-4 text-primary-light" />
      资产库
    </button>
  )
}
