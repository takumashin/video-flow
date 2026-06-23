/** 共享 UI 类名，配合 globals.css 语义 token 使用 */
export const inputClass =
  'nodrag nowheel nokey cursor-text w-full rounded-md border border-border bg-input px-2.5 py-1.5 text-xs text-foreground outline-none placeholder:text-muted focus:border-primary-light focus:ring-1 focus:ring-primary-light/30 disabled:cursor-not-allowed disabled:opacity-50'

export const btnSecondaryClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-border bg-input px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-surface-muted disabled:opacity-50'

export const btnCompactClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-border bg-input px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm transition hover:bg-surface-muted disabled:opacity-50'

export function dropdownAnchorClass(
  placement: 'above' | 'below',
  align: 'left' | 'right' = 'left',
) {
  if (placement === 'above') {
    return align === 'right'
      ? 'absolute right-0 bottom-full z-[110] mb-2'
      : 'absolute left-0 bottom-full z-[110] mb-2'
  }

  return align === 'right'
    ? 'absolute right-0 top-full z-[110] mt-2'
    : 'absolute left-0 top-full z-[110] mt-2'
}

export const panelClass =
  'rounded-xl border border-border bg-surface shadow-sm'

export const dropdownClass =
  'overflow-hidden rounded-xl border border-border bg-surface shadow-xl'
