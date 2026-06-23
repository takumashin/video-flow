export function formatNodeAudioTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0)
    return '00:00'
  const total = Math.floor(seconds)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
