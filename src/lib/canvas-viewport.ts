import type { Viewport } from 'reactflow'

/** 画布初始视口：固定 65% 缩放，不自动 fitView */
export const CANVAS_DEFAULT_VIEWPORT: Viewport = {
  x: 48,
  y: 32,
  zoom: 0.65,
}

/** 手动「适应画布」按钮使用的 fitView 参数 */
export const CANVAS_FIT_VIEW_OPTIONS = { padding: 0.35, maxZoom: 0.85 }
