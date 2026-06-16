export const ASSET_DRAG_MIME = 'application/seedance-asset'

export type AssetDragPayload = {
  id?: string
  kind: 'image' | 'video' | 'audio'
  url: string
  filename?: string
}

export function setAssetDragData(dataTransfer: DataTransfer, payload: AssetDragPayload) {
  dataTransfer.setData(ASSET_DRAG_MIME, JSON.stringify(payload))
  dataTransfer.effectAllowed = 'copy'
}

export function hasAssetDrag(dataTransfer: DataTransfer): boolean {
  return dataTransfer.types.includes(ASSET_DRAG_MIME)
}

export function readAssetDragData(dataTransfer: DataTransfer): AssetDragPayload | null {
  const raw = dataTransfer.getData(ASSET_DRAG_MIME)
  if (!raw)
    return null
  try {
    const parsed = JSON.parse(raw) as AssetDragPayload
    if (parsed.kind && parsed.url)
      return parsed
    return null
  }
  catch {
    return null
  }
}
