import { create } from 'zustand'
import type { UploadAssetKind } from '@/lib/uploads'

export type AssetFolderFilter = 'all' | 'uncategorized' | string

type AssetLibraryStore = {
  isOpen: boolean
  refreshKey: number
  draggingAssetKind: UploadAssetKind | null
  selectedFolderId: AssetFolderFilter
  setOpen: (open: boolean) => void
  toggle: () => void
  bumpRefresh: () => void
  setDraggingAssetKind: (kind: UploadAssetKind | null) => void
  setSelectedFolderId: (folderId: AssetFolderFilter) => void
}

export const useAssetLibraryStore = create<AssetLibraryStore>(set => ({
  isOpen: false,
  refreshKey: 0,
  draggingAssetKind: null,
  selectedFolderId: 'all',
  setOpen: open => set({ isOpen: open }),
  toggle: () => set(state => ({ isOpen: !state.isOpen })),
  bumpRefresh: () => set(state => ({ refreshKey: state.refreshKey + 1 })),
  setDraggingAssetKind: kind => set({ draggingAssetKind: kind }),
  setSelectedFolderId: selectedFolderId => set({ selectedFolderId }),
}))
