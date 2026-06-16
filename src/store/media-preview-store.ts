import { create } from 'zustand'

export type MediaPreviewItem = {
  kind: 'image' | 'video' | 'audio'
  url: string
  title?: string
}

type MediaPreviewStore = {
  item: MediaPreviewItem | null
  open: (item: MediaPreviewItem) => void
  close: () => void
}

export const useMediaPreviewStore = create<MediaPreviewStore>(set => ({
  item: null,
  open: item => set({ item }),
  close: () => set({ item: null }),
}))

export function openMediaPreview(item: MediaPreviewItem) {
  useMediaPreviewStore.getState().open(item)
}
