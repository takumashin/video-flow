import { create } from 'zustand'
import type { UploadAssetKind } from '@/lib/uploads'

type AssetLibraryStore = {
  isOpen: boolean
  refreshKey: number
  draggingAssetKind: UploadAssetKind | null
  setOpen: (open: boolean) => void
  toggle: () => void
  bumpRefresh: () => void
  setDraggingAssetKind: (kind: UploadAssetKind | null) => void
}

export const useAssetLibraryStore = create<AssetLibraryStore>(set => ({
  isOpen: false,
  refreshKey: 0,
  draggingAssetKind: null,
  setOpen: open => set({ isOpen: open }),
  toggle: () => set(state => ({ isOpen: !state.isOpen })),
  bumpRefresh: () => set(state => ({ refreshKey: state.refreshKey + 1 })),
  setDraggingAssetKind: kind => set({ draggingAssetKind: kind }),
}))
