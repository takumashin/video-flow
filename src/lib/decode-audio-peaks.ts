export function fallbackPeaks(barCount: number): number[] {
  return Array.from({ length: barCount }, (_, i) => {
    const wave = Math.abs(Math.sin(i * 0.41)) * Math.abs(Math.cos(i * 0.17))
    const envelope = 0.35 + 0.65 * Math.sin((i / barCount) * Math.PI)
    return 0.12 + 0.88 * wave * envelope
  })
}

function resolveFetchUrl(src: string): string {
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('blob:'))
    return src
  if (typeof window === 'undefined')
    return src
  return new URL(src, window.location.origin).href
}

function percentile(sorted: number[], ratio: number): number {
  if (sorted.length === 0)
    return 0
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)))
  return sorted[index] ?? 0
}

function normalizePeaksForDisplay(values: number[]): number[] {
  if (values.length === 0)
    return []

  const sorted = [...values].sort((a, b) => a - b)
  const floor = percentile(sorted, 0.1)
  const ceiling = percentile(sorted, 0.9)
  const range = Math.max(ceiling - floor, 0.0001)

  return values.map((value) => {
    const scaled = Math.min(1, Math.max(0, (value - floor) / range))
    // Stronger curve so quiet sections stay visibly shorter than loud ones.
    return 0.1 + 0.9 * Math.pow(scaled, 0.55)
  })
}

function computePeaksFromBuffer(audioBuffer: AudioBuffer, barCount: number): number[] {
  const length = audioBuffer.length
  const samplesPerBar = Math.max(1, Math.floor(length / barCount))
  const rmsValues: number[] = []

  for (let i = 0; i < barCount; i++) {
    const start = i * samplesPerBar
    const end = Math.min(start + samplesPerBar, length)
    let sumSquares = 0
    let count = 0

    for (let j = start; j < end; j++) {
      let mixed = 0
      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++)
        mixed += audioBuffer.getChannelData(ch)[j] ?? 0
      mixed /= audioBuffer.numberOfChannels
      sumSquares += mixed * mixed
      count++
    }

    rmsValues.push(count > 0 ? Math.sqrt(sumSquares / count) : 0)
  }

  return normalizePeaksForDisplay(rmsValues)
}

export async function decodeAudioPeaks(src: string, barCount: number): Promise<number[]> {
  try {
    const response = await fetch(resolveFetchUrl(src), { credentials: 'include' })
    if (!response.ok)
      throw new Error('fetch failed')

    const arrayBuffer = await response.arrayBuffer()
    const audioContext = new AudioContext()
    try {
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0))
      return computePeaksFromBuffer(audioBuffer, barCount)
    }
    finally {
      await audioContext.close()
    }
  }
  catch {
    return fallbackPeaks(barCount)
  }
}
