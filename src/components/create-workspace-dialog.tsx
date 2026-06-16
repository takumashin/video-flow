'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { FolderPlus, Loader2, X } from 'lucide-react'

type CreateWorkspaceDialogProps = {
  open: boolean
  creating: boolean
  error: string | null
  onClose: () => void
  onSubmit: (name: string) => void
}

export default function CreateWorkspaceDialog({
  open,
  creating,
  error,
  onClose,
  onSubmit,
}: CreateWorkspaceDialogProps) {
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

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <FolderPlus className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold text-foreground">
                创建工作空间
              </h2>
              <p id={descId} className="mt-0.5 text-xs text-muted">
                新建独立空间，工作流与资产库将彼此隔离
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="shrink-0 rounded-lg p-2 text-muted transition hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="workspace-name" className="mb-1.5 block text-sm font-medium text-foreground">
              工作空间名称
            </label>
            <input
              ref={inputRef}
              id="workspace-name"
              type="text"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="例如：品牌视频项目"
              maxLength={40}
              disabled={creating}
              className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none ring-primary/30 transition placeholder:text-muted focus:ring-2 disabled:opacity-60"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="rounded-lg border border-border bg-input px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-muted disabled:opacity-60"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
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
