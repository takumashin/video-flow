'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { FolderPlus, Loader2, X } from 'lucide-react'

type CreateAssetFolderDialogProps = {
  open: boolean
  creating: boolean
  error: string | null
  onClose: () => void
  onSubmit: (name: string) => void
}

export default function CreateAssetFolderDialog({
  open,
  creating,
  error,
  onClose,
  onSubmit,
}: CreateAssetFolderDialogProps) {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    if (!open)
      return

    setName('')
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !creating)
        onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, creating, onClose])

  if (!open)
    return null

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || creating)
      return
    onSubmit(trimmed)
  }

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={creating ? undefined : onClose}
        aria-label="关闭"
        disabled={creating}
      />

      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <FolderPlus className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold text-foreground">
                新建文件夹
              </h2>
              <p id={descId} className="mt-0.5 text-xs text-muted">
                在当前工作空间创建资产分类
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="rounded-md p-1.5 text-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="asset-folder-name" className="text-xs font-medium text-secondary">
              文件夹名称
            </label>
            <input
              ref={inputRef}
              id="asset-folder-name"
              type="text"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="例如：品牌素材"
              maxLength={64}
              disabled={creating}
              className="mt-1.5 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none ring-primary/30 placeholder:text-muted focus:border-primary-light focus:ring-2 disabled:opacity-50"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="rounded-lg border border-border px-3 py-2 text-sm text-secondary hover:bg-surface-muted disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-[#104BD4] disabled:opacity-50"
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              创建
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
