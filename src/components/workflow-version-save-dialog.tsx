'use client'

import { useState } from 'react'
import { Bookmark, Loader2 } from 'lucide-react'
import { useWorkflowVersionStore } from '@/store/workflow-version-store'
import { useActiveWorkflowSession } from '@/components/workflow-tabs'

export default function WorkflowVersionSaveDialog() {
  const saveDialogOpen = useWorkflowVersionStore(s => s.saveDialogOpen)
  const closeSaveDialog = useWorkflowVersionStore(s => s.closeSaveDialog)
  const actionLoading = useWorkflowVersionStore(s => s.actionLoading)
  const save = useWorkflowVersionStore(s => s.saveNamedVersion)
  const error = useWorkflowVersionStore(s => s.error)
  const clearError = useWorkflowVersionStore(s => s.clearError)

  const activeSession = useActiveWorkflowSession()
  const workflowId = activeSession?.workflowId ?? null

  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')

  if (!saveDialogOpen || !workflowId) return null

  const handleSave = async () => {
    if (!label.trim()) return
    await save(workflowId, label.trim(), description.trim() || undefined)
    setLabel('')
    setDescription('')
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        <div className="mb-3 flex items-center gap-2">
          <Bookmark className="h-5 w-5 text-primary-light" />
          <h2 className="text-base font-semibold text-foreground">保存版本</h2>
        </div>

        <p className="text-sm text-muted">
          为当前工作流状态保存一个命名版本，方便以后回溯。
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="version-label" className="mb-1 block text-xs font-medium text-foreground">
              版本标签 <span className="text-red-500">*</span>
            </label>
            <input
              id="version-label"
              type="text"
              value={label}
              onChange={e => { setLabel(e.target.value); clearError() }}
              placeholder="例如：客户评审前、v2.0 终版"
              className="nodrag nowheel nokey w-full rounded-md border border-border bg-input px-2.5 py-1.5 text-xs text-foreground outline-none placeholder:text-muted focus:border-primary-light focus:ring-1 focus:ring-primary-light/30"
              disabled={actionLoading}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') void handleSave() }}
            />
          </div>

          <div>
            <label htmlFor="version-desc" className="mb-1 block text-xs font-medium text-foreground">
              备注（可选）
            </label>
            <textarea
              id="version-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="这次保存有什么特别之处？"
              className="nodrag nowheel nokey w-full resize-none rounded-md border border-border bg-input px-2.5 py-1.5 text-xs text-foreground outline-none placeholder:text-muted focus:border-primary-light focus:ring-1 focus:ring-primary-light/30"
              rows={2}
              disabled={actionLoading}
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-500">{error}</p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => { closeSaveDialog(); setLabel(''); setDescription(''); clearError() }}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-surface-muted hover:text-foreground"
            disabled={actionLoading}
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!label.trim() || actionLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            保存版本
          </button>
        </div>
      </div>
    </div>
  )
}
