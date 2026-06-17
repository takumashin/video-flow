'use client'

import { useEffect, useRef } from 'react'

type TrailPoint = { x: number, y: number, born: number, weight: number }

type CellAnchor = {
  x: number
  y: number
  gain: number
  fx: number
  fy: number
  phaseX: number
  phaseY: number
  driftAmp: number
}

type SoftShape = {
  x: number
  y: number
  size: number
  morph: number
  drift: number
  freqX: number
  freqY: number
  phaseX: number
  phaseY: number
  gain: number
}

type RuntimeCell = { cx: number, cy: number, gain: number }
type RuntimeShape = { sx: number, sy: number, half: number, mixT: number, gain: number }

type SimState = {
  width: number
  height: number
  spacing: number
  cellGain: number
  shapeGain: number
  ringGain: number
  ringWidth: number
  trailSigma: number
  trailLife: number
  morphSpeed: number
  pointerEase: number
  dotMin: number
  dotMax: number
  drawThreshold: number
  strength: number
  radius: number
  t: number
  lastTime: number
  fgRGB: string
}

const LAYER_COUNT = 8
const FRAME_MS = 1000 / 30
const TRAIL_MAX = 120

function smoothstep(value: number) {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

function ringField(dist: number, center: number, width: number, time: number, freq: number, gain: number) {
  const delta = Math.abs(dist - (center + Math.sin(time * freq) * width * 0.6))
  if (delta > width)
    return 0
  const t = 1 - delta / width
  return t * t * gain
}

function sdCircle(x: number, y: number, radius: number) {
  return Math.hypot(x, y) - radius
}

function sdBox(x: number, y: number, half: number) {
  const ax = Math.abs(x) - half
  const ay = Math.abs(y) - half
  return Math.hypot(Math.max(ax, 0), Math.max(ay, 0)) + Math.min(Math.max(ax, ay), 0)
}

function parsePrimaryRgb() {
  if (typeof window === 'undefined')
    return '59,130,246'

  const raw = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
  if (!raw)
    return '59,130,246'

  if (raw.startsWith('#')) {
    const hex = raw.slice(1)
    const full = hex.length === 3
      ? hex.split('').map(ch => ch + ch).join('')
      : hex
    const num = Number.parseInt(full, 16)
    return `${(num >> 16) & 255},${(num >> 8) & 255},${num & 255}`
  }

  const rgbMatch = raw.match(/(\d+)\s+(\d+)\s+(\d+)/)
  if (rgbMatch)
    return `${rgbMatch[1]},${rgbMatch[2]},${rgbMatch[3]}`

  return '59,130,246'
}

function createCells(count: number): CellAnchor[] {
  const cells: CellAnchor[] = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI * 0.5
    const radius = 0.18 + Math.random() * 0.22
    cells.push({
      x: 0.5 + Math.cos(angle) * radius,
      y: 0.5 + Math.sin(angle) * radius,
      gain: 0.25 + Math.random() * 0.45,
      fx: 0.12 + Math.random() * 0.35,
      fy: 0.12 + Math.random() * 0.35,
      phaseX: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
      driftAmp: 0.012 + Math.random() * 0.02,
    })
  }
  return cells
}

function createShapes(count: number): SoftShape[] {
  const shapes: SoftShape[] = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI * 0.5
    const spread = 0.12 + Math.random() * 0.16
    shapes.push({
      x: 0.5 + Math.cos(angle) * spread,
      y: 0.5 + Math.sin(angle) * spread,
      size: Math.max(0.004, 0.012 + Math.random() * 0.018),
      morph: Math.random() * Math.PI * 2,
      drift: 0.003 + Math.random() * 0.006,
      freqX: 0.16 + Math.random() * 0.52,
      freqY: 0.16 + Math.random() * 0.52,
      phaseX: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
      gain: 0.2 + Math.random() * 0.4,
    })
  }
  return shapes
}

type AuthCanvasBackgroundProps = {
  height?: number
}

export function AuthCanvasBackground({ height = 700 }: AuthCanvasBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas)
      return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion)
      return

    const canvasEl = canvas
    const ctxRaw = canvasEl.getContext('2d')
    if (!ctxRaw)
      return
    const ctx: CanvasRenderingContext2D = ctxRaw

    const pointer = { x: 0, y: 0, tx: 0, ty: 0, active: false }
    const trails: TrailPoint[] = []
    const cells = createCells(10)
    const shapes = createShapes(6)
    const runtimeCells: RuntimeCell[] = []
    const runtimeShapes: RuntimeShape[] = []
    const layerBuckets = Array.from({ length: LAYER_COUNT }, () => new Float32Array(4096))
    const layerCounts = new Array<number>(LAYER_COUNT).fill(0)

    let frameId = 0
    let cellRadiusSq = 0
    let cellSigmaSq = 0
    let shapeSigmaSq = 0
    let trailSigmaSq = 0
    let trailCutoffSq = 0
    let pointerSigmaSq = 0
    let pointerGain = 0
    let ringCenterX = 0
    let ringCenterY = -200

    const sim: SimState = {
      width: 0,
      height: 0,
      spacing: 28,
      cellGain: 0.55,
      shapeGain: 0.42,
      ringGain: 0.38,
      ringWidth: 1.15,
      trailSigma: 0.55,
      trailLife: 0.75,
      morphSpeed: 0.85,
      pointerEase: 0.08,
      dotMin: 0.08,
      dotMax: 0.22,
      drawThreshold: 0.18,
      strength: 0.65,
      radius: 180,
      t: 0,
      lastTime: performance.now(),
      fgRGB: parsePrimaryRgb(),
    }

    function resize() {
      const rect = canvasEl.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      sim.width = Math.max(1, rect.width)
      sim.height = Math.max(1, rect.height)
      canvasEl.width = Math.floor(sim.width * dpr)
      canvasEl.height = Math.floor(sim.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      sim.fgRGB = parsePrimaryRgb()
      sim.spacing = Math.max(22, Math.min(34, sim.width / 48))
      pointer.x = sim.width * 0.5
      pointer.y = sim.height * 0.5
      pointer.tx = pointer.x
      pointer.ty = pointer.y
      ringCenterX = sim.width * 0.5
    }

    function prepareField(time: number) {
      const cellReach = (sim.spacing * 1.2 + 18) * 1.15
      cellRadiusSq = cellReach * cellReach
      cellSigmaSq = 2 * cellReach * cellReach

      while (runtimeCells.length < cells.length)
        runtimeCells.push({ cx: 0, cy: 0, gain: 0 })

      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i]
        const runtime = runtimeCells[i]
        runtime.cx = (cell.x + Math.sin(time * cell.fx + cell.phaseX) * cell.driftAmp) * sim.width
        runtime.cy = (cell.y + Math.cos(time * cell.fy + cell.phaseY) * cell.driftAmp) * sim.height
        runtime.gain = cell.gain
      }

      const shapeReach = sim.spacing * 0.7
      shapeSigmaSq = 2 * shapeReach * shapeReach

      while (runtimeShapes.length < shapes.length)
        runtimeShapes.push({ sx: 0, sy: 0, half: 0, mixT: 0, gain: 0 })

      const minSide = Math.min(sim.width, sim.height)
      for (let i = 0; i < shapes.length; i++) {
        const shape = shapes[i]
        const runtime = runtimeShapes[i]
        runtime.sx = (shape.x + Math.sin(time * shape.freqX + shape.phaseX) * shape.drift) * sim.width
        runtime.sy = (shape.y + Math.cos(time * shape.freqY + shape.phaseY) * shape.drift) * sim.height
        runtime.half = shape.size * minSide
        runtime.mixT = 0.5 + 0.5 * Math.sin(time * sim.morphSpeed + shape.morph)
        runtime.gain = shape.gain
      }

      const trailReach = sim.trailSigma + sim.strength * 14
      trailSigmaSq = 2 * trailReach * trailReach
      trailCutoffSq = trailReach * 3 * (trailReach * 3)

      const pointerReach = Math.max(20, sim.radius * 0.32)
      pointerSigmaSq = 2 * pointerReach * pointerReach
      pointerGain = 0.55 + sim.strength * 0.4
    }

    function sampleField(x: number, y: number, time: number, cssW: number, cssH: number) {
      const nx = x / cssW
      const ny = y / cssH
      const wave = 0.28 * Math.sin((nx * 6.7 + time * 0.45) * 1.5)
        + 0.24 * Math.cos((ny * 6.2 - time * 0.38) * 1.7)
        + 0.2 * Math.sin((nx + ny) * 14 - time * 0.8)

      let cellField = 0
      for (const cell of runtimeCells) {
        const dx = x - cell.cx
        const dy = y - cell.cy
        const distSq = dx * dx + dy * dy
        if (distSq > cellRadiusSq)
          continue
        cellField += Math.exp(-distSq / cellSigmaSq) * cell.gain
      }

      const ringDist = Math.hypot(x - ringCenterX, y - ringCenterY)
      const ringA = ringField(ringDist, cssW * 0.18, sim.spacing * sim.ringWidth, time, 1.1, sim.ringGain)
      const ringB = ringField(ringDist, cssW * 0.31, sim.spacing * (sim.ringWidth + 1.1), time, 0.8, sim.ringGain * 0.85)

      let shapeField = 0
      for (const shape of runtimeShapes) {
        const dx = x - shape.sx
        const dy = y - shape.sy
        const circle = sdCircle(dx, dy, shape.half * 0.8)
        const box = sdBox(dx, dy, shape.half)
        const mixed = circle + (box - circle) * shape.mixT
        shapeField += Math.exp(-(mixed * mixed) / shapeSigmaSq) * shape.gain
      }

      let trailField = 0
      for (let i = trails.length - 1; i >= 0; i--) {
        const trail = trails[i]
        const age = time - trail.born
        if (age > sim.trailLife)
          break
        const dx = x - trail.x
        const dy = y - trail.y
        const distSq = dx * dx + dy * dy
        if (distSq > trailCutoffSq)
          continue
        trailField += Math.exp(-distSq / trailSigmaSq) * Math.exp(-age * 3) * 0.95 * trail.weight
      }

      const pdx = x - pointer.x
      const pdy = y - pointer.y
      const pointerField = Math.exp(-(pdx * pdx + pdy * pdy) / pointerSigmaSq) * pointerGain

      return smoothstep(
        0.12 + wave * 0.2 + cellField * sim.cellGain + ringA + ringB + shapeField * sim.shapeGain + trailField + pointerField,
      )
    }

    function updatePointer() {
      if (!pointer.active) {
        pointer.tx = sim.width * 0.5 + Math.cos(sim.t * 0.0002) * sim.width * 0.08
        pointer.ty = sim.height * 0.5 + Math.sin(sim.t * 0.00025) * sim.height * 0.08
      }
      pointer.x += (pointer.tx - pointer.x) * sim.pointerEase
      pointer.y += (pointer.ty - pointer.y) * sim.pointerEase
    }

    function pruneTrails(time: number) {
      const maxAge = Math.max(0.3, sim.trailLife + 0.35)
      while (trails.length && time - trails[0].born > maxAge)
        trails.shift()
      if (trails.length > TRAIL_MAX)
        trails.splice(0, trails.length - TRAIL_MAX)
    }

    function drawFrame(now: number) {
      const delta = now - sim.lastTime
      if (delta < FRAME_MS) {
        frameId = requestAnimationFrame(drawFrame)
        return
      }

      sim.t = now
      sim.lastTime = now - delta % FRAME_MS

      const cssW = sim.width
      const cssH = sim.height
      const time = now * 0.001

      ctx.clearRect(0, 0, cssW, cssH)
      updatePointer()
      pruneTrails(time)
      prepareField(time)

      for (let i = 0; i < LAYER_COUNT; i++)
        layerCounts[i] = 0

      const spacing = sim.spacing
      for (let row = 0, y = spacing * 0.5; y < cssH; row++, y += spacing) {
        for (let x = spacing * 0.5 + (row % 2 ? spacing * 0.5 : 0); x < cssW; x += spacing) {
          const value = sampleField(x, y, time, cssW, cssH)
          if (value < sim.drawThreshold)
            continue

          const radius = Math.max(0.18, spacing * (sim.dotMin + value * sim.dotMax))
          const alpha = Math.min(0.7, 0.05 + value * 0.55)
          const layer = Math.min(LAYER_COUNT - 1, Math.floor(alpha / 0.7 * LAYER_COUNT))
          let offset = layerCounts[layer]

          if (offset + 3 > layerBuckets[layer].length) {
            const expanded = new Float32Array(layerBuckets[layer].length * 2)
            expanded.set(layerBuckets[layer])
            layerBuckets[layer] = expanded
          }

          layerBuckets[layer][offset] = x
          layerBuckets[layer][offset + 1] = y
          layerBuckets[layer][offset + 2] = radius
          layerCounts[layer] = offset + 3
        }
      }

      for (let layer = 0; layer < LAYER_COUNT; layer++) {
        const count = layerCounts[layer]
        if (!count)
          continue

        const alpha = ((layer + 0.5) / LAYER_COUNT) * 0.7
        ctx.fillStyle = `rgba(${sim.fgRGB},${alpha.toFixed(3)})`
        ctx.beginPath()

        const bucket = layerBuckets[layer]
        for (let i = 0; i < count; i += 3) {
          const px = bucket[i]
          const py = bucket[i + 1]
          const pr = bucket[i + 2]
          ctx.moveTo(px + pr, py)
          ctx.arc(px, py, pr, 0, Math.PI * 2)
        }
        ctx.fill()
      }

      frameId = requestAnimationFrame(drawFrame)
    }

    function onPointerMove(event: PointerEvent) {
      const rect = canvasEl.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
        pointer.active = false
        return
      }
      pointer.tx = x
      pointer.ty = y
      pointer.active = true
      trails.push({
        x,
        y,
        born: performance.now() * 0.001,
        weight: 1,
      })
    }

    function onPointerLeave() {
      pointer.active = false
    }

    function onVisibilityChange() {
      if (document.hidden) {
        cancelAnimationFrame(frameId)
        return
      }
      sim.lastTime = performance.now()
      frameId = requestAnimationFrame(drawFrame)
    }

    resize()
    frameId = requestAnimationFrame(drawFrame)

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerleave', onPointerLeave)
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisibilityChange)

    const themeObserver = new MutationObserver(() => {
      sim.fgRGB = parsePrimaryRgb()
    })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerleave', onPointerLeave)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      themeObserver.disconnect()
    }
  }, [height])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute top-0 left-0 z-[2] w-full [mask-image:linear-gradient(to_bottom,black_0%,black_75%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_75%,transparent_100%)]"
      style={{ height: `${height}px` }}
    />
  )
}
