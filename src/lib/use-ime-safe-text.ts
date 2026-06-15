'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** 受控文本在 IME 组合期间不同步到外部 store，避免中文输入被打断 */
export function useImeSafeTextValue(externalValue: string, onChange: (value: string) => void) {
  const [localValue, setLocalValue] = useState(externalValue)
  const isComposingRef = useRef(false)

  useEffect(() => {
    if (!isComposingRef.current && externalValue !== localValue)
      setLocalValue(externalValue)
  }, [externalValue, localValue])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const nextValue = e.target.value
    setLocalValue(nextValue)
    if (!isComposingRef.current)
      onChange(nextValue)
  }, [onChange])

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true
  }, [])

  const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    isComposingRef.current = false
    const nextValue = e.currentTarget.value
    setLocalValue(nextValue)
    onChange(nextValue)
  }, [onChange])

  const bind = {
    value: localValue,
    onChange: handleChange,
    onCompositionStart: handleCompositionStart,
    onCompositionEnd: handleCompositionEnd,
    onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation(),
  }

  return { bind, localValue, setLocalValue }
}
