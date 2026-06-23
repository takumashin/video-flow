'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FileAudio, FileVideo, Type } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  editorNeedsChipRender,
  extractPlainTextFromPromptEditor,
  getCaretPlainOffset,
  pastePlainTextAtSelection,
  refsImageSignature,
  renderPromptEditor,
  setCaretPlainOffset,
} from '@/lib/prompt-editor-dom'
import {
  buildMentionOptions,
  type MentionOption,
} from '@/lib/seedance-upstream'
import type { SeedanceUpstreamRefs } from '@/lib/seedance-upstream'
import type { SeedanceGenerationMode } from '@/lib/types'
import { FieldLabel } from './node-fields'

type PromptWithMentionsProps = {
  value: string
  onChange: (value: string) => void
  refs: SeedanceUpstreamRefs
  mode?: SeedanceGenerationMode
  disabled?: boolean
  placeholder?: string
  /** sidebar：右侧生成配置栏；wide：节点下方宽面板；modal：独立弹窗 */
  variant?: 'default' | 'sidebar' | 'wide' | 'modal'
  showLabel?: boolean
  showCharCount?: boolean
}

export default function PromptWithMentions({
  value,
  onChange,
  refs,
  mode,
  disabled,
  placeholder,
  variant = 'default',
  showLabel,
  showCharCount = false,
}: PromptWithMentionsProps) {
  const isSidebar = variant === 'sidebar'
  const isWide = variant === 'wide'
  const isModal = variant === 'modal'
  const showFieldLabel = showLabel ?? (!isWide && !isModal)
  const editorRef = useRef<HTMLDivElement>(null)
  const isComposingRef = useRef(false)
  const skipExternalSyncRef = useRef(false)
  const editorInitializedRef = useRef(false)
  const [localValue, setLocalValue] = useState(value)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState<number | null>(null)

  const resolvedPlaceholder = placeholder ?? '描述视频内容，输入 @ 引用已连接素材，如 @图片1、@视频1、@音频1'
  const refsSignature = refsImageSignature(refs)

  const allOptions = buildMentionOptions(refs, mode)
  const mediaOptions = allOptions.filter(
    option => option.kind === 'image' || option.kind === 'video' || option.kind === 'audio',
  )
  const filteredOptions = mentionQuery
    ? allOptions.filter(option =>
        option.label.includes(mentionQuery)
        || option.description?.includes(mentionQuery)
        || option.insert.includes(mentionQuery),
      )
    : allOptions

  const closeMention = useCallback(() => {
    setMentionOpen(false)
    setMentionQuery('')
    setMentionStart(null)
    setMentionIndex(0)
  }, [])

  const syncMentionState = useCallback((text: string, cursor: number) => {
    const beforeCursor = text.slice(0, cursor)
    const atIndex = beforeCursor.lastIndexOf('@')

    if (atIndex === -1) {
      closeMention()
      return
    }

    const charBefore = atIndex > 0 ? beforeCursor[atIndex - 1] : ' '
    if (charBefore !== ' ' && charBefore !== '\n' && atIndex !== 0) {
      closeMention()
      return
    }

    const query = beforeCursor.slice(atIndex + 1)
    if (query.includes(' ') || query.includes('\n')) {
      closeMention()
      return
    }

    if (allOptions.length === 0) {
      closeMention()
      return
    }

    setMentionStart(atIndex)
    setMentionQuery(query)
    setMentionOpen(true)
    setMentionIndex(0)
  }, [allOptions.length, closeMention])

  const syncEditorFromPlain = useCallback((text: string, caret?: number) => {
    const editor = editorRef.current
    if (!editor)
      return

    renderPromptEditor(editor, text, refs)
    if (caret !== undefined)
      requestAnimationFrame(() => setCaretPlainOffset(editor, caret))
  }, [refs])

  const maybeRenderChips = useCallback((text: string, caret?: number) => {
    const editor = editorRef.current
    if (!editor || !editorNeedsChipRender(editor, text, refs))
      return

    renderPromptEditor(editor, text, refs)
    if (caret !== undefined)
      setCaretPlainOffset(editor, caret)
  }, [refs])

  // 外部 value 变更（非本组件输入引起）
  useEffect(() => {
    if (skipExternalSyncRef.current) {
      skipExternalSyncRef.current = false
      return
    }
    if (!isComposingRef.current && value !== localValue) {
      setLocalValue(value)
      syncEditorFromPlain(value)
    }
  }, [value, localValue, syncEditorFromPlain])

  // 首次挂载：用 props 初始化编辑器
  useEffect(() => {
    const editor = editorRef.current
    if (!editor || editorInitializedRef.current)
      return

    editorInitializedRef.current = true
    renderPromptEditor(editor, value, refs)
    setLocalValue(value)
  }, [value, refs])

  // 连接图片变化时仅更新 chip 缩略图，保留光标
  useEffect(() => {
    const editor = editorRef.current
    if (!editor || !editorInitializedRef.current || isComposingRef.current)
      return

    const cursor = getCaretPlainOffset(editor)
    const text = extractPlainTextFromPromptEditor(editor)
    renderPromptEditor(editor, text, refs)
    requestAnimationFrame(() => setCaretPlainOffset(editor, cursor))
  }, [refsSignature])

  const commitPlainText = useCallback((nextValue: string, cursor?: number) => {
    skipExternalSyncRef.current = true
    setLocalValue(nextValue)
    onChange(nextValue)
    syncEditorFromPlain(nextValue, cursor)
    if (cursor !== undefined)
      syncMentionState(nextValue, cursor)
  }, [onChange, syncEditorFromPlain, syncMentionState])

  const insertAtPosition = useCallback((insert: string, start: number, end: number) => {
    const editor = editorRef.current
    const plain = editor ? extractPlainTextFromPromptEditor(editor) : localValue
    const before = plain.slice(0, start)
    const after = plain.slice(end)
    const needsSpaceBefore = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n')
    const needsSpaceAfter = after.length > 0 && !after.startsWith(' ')
    const nextValue = `${before}${needsSpaceBefore ? ' ' : ''}${insert}${needsSpaceAfter ? ' ' : ''}${after}`
    const cursor = before.length + (needsSpaceBefore ? 1 : 0) + insert.length + (needsSpaceAfter ? 1 : 0)

    commitPlainText(nextValue, cursor)

    requestAnimationFrame(() => editor?.focus())
  }, [commitPlainText, localValue])

  const insertMention = useCallback((option: MentionOption) => {
    const editor = editorRef.current
    if (!editor || mentionStart === null)
      return

    const end = getCaretPlainOffset(editor)
    insertAtPosition(option.insert, mentionStart, end)
    closeMention()
  }, [closeMention, insertAtPosition, mentionStart])

  const insertMentionAtCursor = useCallback((insert: string) => {
    const editor = editorRef.current
    if (!editor)
      return
    const start = getCaretPlainOffset(editor)
    insertAtPosition(insert, start, start)
  }, [insertAtPosition])

  const openMentionAtCursor = useCallback(() => {
    const editor = editorRef.current
    if (!editor || allOptions.length === 0)
      return

    const plain = extractPlainTextFromPromptEditor(editor)
    const cursor = getCaretPlainOffset(editor)
    const before = plain.slice(0, cursor)
    const after = plain.slice(cursor)
    const nextValue = `${before}@${after}`

    commitPlainText(nextValue, cursor + 1)
    setMentionStart(cursor)
    setMentionQuery('')
    setMentionOpen(true)
    setMentionIndex(0)

    requestAnimationFrame(() => editor.focus())
  }, [allOptions.length, commitPlainText])

  const handleInput = () => {
    const editor = editorRef.current
    if (!editor)
      return

    const nextValue = extractPlainTextFromPromptEditor(editor)
    const cursor = getCaretPlainOffset(editor)

    setLocalValue(nextValue)

    if (isComposingRef.current)
      return

    skipExternalSyncRef.current = true
    onChange(nextValue)
    syncMentionState(nextValue, cursor)
    maybeRenderChips(nextValue, cursor)
  }

  const handleCompositionStart = () => {
    isComposingRef.current = true
    closeMention()
  }

  const handleCompositionEnd = () => {
    isComposingRef.current = false
    const editor = editorRef.current
    if (!editor)
      return

    const nextValue = extractPlainTextFromPromptEditor(editor)
    const cursor = getCaretPlainOffset(editor)
    skipExternalSyncRef.current = true
    setLocalValue(nextValue)
    onChange(nextValue)
    syncMentionState(nextValue, cursor)
    maybeRenderChips(nextValue, cursor)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation()

    if (e.nativeEvent.isComposing || isComposingRef.current)
      return

    if (mentionOpen && filteredOptions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex(i => (i + 1) % filteredOptions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex(i => (i - 1 + filteredOptions.length) % filteredOptions.length)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        insertMention(filteredOptions[mentionIndex])
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        insertMention(filteredOptions[mentionIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        closeMention()
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      document.execCommand('insertLineBreak')
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    if (!text)
      return
    pastePlainTextAtSelection(text)
    handleInput()
  }

  useEffect(() => {
    if (mentionIndex >= filteredOptions.length)
      setMentionIndex(0)
  }, [filteredOptions.length, mentionIndex])

  const showPlaceholder = !localValue

  return (
    <div className={cn('space-y-2', (isWide || isModal) && 'space-y-0')}>
      {showFieldLabel && (
        <FieldLabel>视频描述（在此编辑，输入 @ 引用图片）</FieldLabel>
      )}

      <div className="relative">
        <div
          className={cn(
            'relative overflow-hidden rounded-md border border-border bg-input transition-[border-color,box-shadow]',
            isWide
              ? 'rounded-lg border-transparent bg-transparent focus-within:border-transparent focus-within:ring-0'
              : isModal
                ? 'rounded-xl focus-within:border-primary-light focus-within:ring-2 focus-within:ring-primary-light/25'
                : 'focus-within:border-primary-light focus-within:ring-1 focus-within:ring-primary-light/30',
            disabled && 'opacity-50',
          )}
        >
          {showPlaceholder && (
            <p
              className={cn(
                'pointer-events-none absolute leading-[1.625] text-muted',
                isSidebar || isWide
                  ? 'left-3 top-2.5 text-sm'
                  : isModal
                    ? 'left-3 top-3 text-sm'
                    : 'left-2.5 top-1.5 text-[0.75rem]',
              )}
              aria-hidden
            >
              {resolvedPlaceholder}
            </p>
          )}

          <div
            ref={editorRef}
            role="textbox"
            aria-multiline="true"
            aria-placeholder={resolvedPlaceholder}
            contentEditable={!disabled}
            suppressContentEditableWarning
            onInput={handleInput}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onBlur={() => setTimeout(closeMention, 150)}
            className={cn(
              'prompt-editor nodrag nowheel nokey cursor-text w-full text-foreground outline-none',
              isSidebar && 'prompt-editor--sidebar px-3 py-2.5',
              isWide && 'prompt-editor--wide px-3 py-2.5',
              isModal && 'prompt-editor--modal px-3 py-3',
              !isSidebar && !isWide && !isModal && 'px-2.5 py-1.5',
              disabled && 'cursor-not-allowed',
            )}
          />
        </div>

        {mentionOpen && filteredOptions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
            <p className="border-b border-border-subtle px-2.5 py-1.5 text-[10px] text-muted">选择要引用的素材</p>
            <ul className="max-h-48 overflow-y-auto py-1">
              {filteredOptions.map((option, index) => (
                <li key={option.id}>
                  <button
                    type="button"
                    className={cn(
                      'nodrag flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-surface-muted',
                      index === mentionIndex && 'bg-primary/10',
                    )}
                    onMouseDown={e => {
                      e.preventDefault()
                      insertMention(option)
                    }}
                  >
                    {option.kind === 'image' && option.imageUrl
                      ? (
                          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border bg-surface-muted">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={option.imageUrl}
                              alt={option.label}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )
                      : option.kind === 'video' && option.mediaUrl
                        ? (
                            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-sky-500/30 bg-sky-500/10">
                              <video
                                src={option.mediaUrl}
                                muted
                                playsInline
                                preload="metadata"
                                className="h-full w-full object-cover"
                              />
                            </div>
                          )
                        : option.kind === 'video'
                          ? (
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-sky-500/30 bg-sky-500/10">
                                <FileVideo className="h-4 w-4 text-sky-500" />
                              </div>
                            )
                          : option.kind === 'audio'
                            ? (
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10">
                                  <FileAudio className="h-4 w-4 text-emerald-500" />
                                </div>
                              )
                            : (
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary-light/30 bg-primary/10">
                                <Type className="h-4 w-4 text-primary-light" />
                              </div>
                            )}
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-medium text-foreground">{option.insert}</span>
                      {option.description && (
                        <span className="block truncate text-[10px] text-muted">{option.description}</span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {mentionOpen && filteredOptions.length === 0 && allOptions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-surface px-2.5 py-2 text-[10px] text-muted shadow-lg">
            无匹配素材
          </div>
        )}
      </div>

      {mediaOptions.length > 0 && !isWide && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={disabled}
            onClick={openMentionAtCursor}
            className="nodrag rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] font-medium text-secondary hover:bg-surface-muted disabled:opacity-50"
          >
            @ 引用
          </button>
          {mediaOptions.map(option => (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => insertMentionAtCursor(option.insert)}
              className={cn(
                'nodrag inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium disabled:opacity-50',
                option.kind === 'image' && 'border-violet-500/30 bg-violet-500/10 text-violet-600 hover:bg-violet-500/15 dark:text-violet-300',
                option.kind === 'video' && 'border-sky-500/30 bg-sky-500/10 text-sky-600 hover:bg-sky-500/15 dark:text-sky-300',
                option.kind === 'audio' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-300',
              )}
            >
              {option.kind === 'image' && option.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={option.imageUrl}
                  alt=""
                  className="h-4 w-4 rounded object-cover"
                />
              )}
              {option.kind === 'video' && option.mediaUrl && (
                <video
                  src={option.mediaUrl}
                  muted
                  playsInline
                  preload="metadata"
                  className="h-4 w-4 rounded object-cover"
                />
              )}
              {option.kind === 'audio' && (
                <FileAudio className="h-3.5 w-3.5 shrink-0" />
              )}
              {option.insert}
            </button>
          ))}
        </div>
      )}

      {showCharCount && (
        <p className="mt-1 text-right text-[10px] tabular-nums text-muted">
          {localValue.length}/10000
        </p>
      )}
    </div>
  )
}
