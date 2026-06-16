export function notifyCreditsChanged() {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new Event('seedance:credits-changed'))
}
