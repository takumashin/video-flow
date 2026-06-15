import {
  splitPromptByMentions,
  type PromptDisplaySegment,
  type SeedanceUpstreamRefs,
} from './seedance-upstream'

const CHIP_CLASS = 'prompt-chip'

export function extractPlainTextFromPromptEditor(root: HTMLElement): string {
  const raw = Array.from(root.childNodes).map(nodeToPlainText).join('')
  if (raw === '\n' && root.childNodes.length === 1 && root.firstChild?.nodeName === 'BR')
    return ''
  return raw
}

function nodeToPlainText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE)
    return node.textContent ?? ''

  if (node.nodeName === 'BR')
    return '\n'

  if (node.nodeType !== Node.ELEMENT_NODE)
    return ''

  const el = node as HTMLElement
  if (el.dataset.mention)
    return el.dataset.mention

  return Array.from(el.childNodes).map(nodeToPlainText).join('')
}

function nodePlainLength(node: Node): number {
  return nodeToPlainText(node).length
}

export function refsImageSignature(refs: SeedanceUpstreamRefs): string {
  const images = refs.images
    .map(image => `${image.index}:${image.nodeId}:${image.imageUrl}:${image.role}`)
    .join('|')
  const videos = refs.videos
    .map(video => `${video.index}:${video.nodeId}:${video.mediaUrl}`)
    .join('|')
  const audios = refs.audios
    .map(audio => `${audio.index}:${audio.nodeId}:${audio.mediaUrl}`)
    .join('|')
  return `${images}#${videos}#${audios}`
}

function collectExpectedMentionTokens(refs: SeedanceUpstreamRefs): string[] {
  const tokens: string[] = []
  for (const image of refs.images)
    tokens.push(`@图片${image.index}`)
  for (const video of refs.videos)
    tokens.push(`@视频${video.index}`)
  for (const audio of refs.audios)
    tokens.push(`@音频${audio.index}`)
  return tokens
}

/** 仅当文本里已有 @引用 但 DOM 里还是纯文字、尚未转成 chip 时需要重绘 */
export function editorNeedsChipRender(
  root: HTMLElement,
  text: string,
  refs: SeedanceUpstreamRefs,
): boolean {
  const chipMentions = new Set(
    Array.from(root.querySelectorAll('[data-mention]'))
      .map(el => (el as HTMLElement).dataset.mention)
      .filter(Boolean),
  )

  for (const token of collectExpectedMentionTokens(refs)) {
    if (text.includes(token) && !chipMentions.has(token))
      return true
  }

  return false
}

export function getCaretPlainOffset(root: HTMLElement): number {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0)
    return 0

  const range = selection.getRangeAt(0)
  const preRange = document.createRange()
  preRange.selectNodeContents(root)
  preRange.setEnd(range.startContainer, range.startOffset)

  const fragment = preRange.cloneContents()
  return Array.from(fragment.childNodes).map(nodeToPlainText).join('').length
}

export function setCaretPlainOffset(root: HTMLElement, offset: number) {
  const selection = window.getSelection()
  if (!selection)
    return

  const range = document.createRange()
  let current = 0
  let placed = false

  const walk = (node: Node) => {
    if (placed)
      return

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? ''
      if (current + text.length >= offset) {
        range.setStart(node, offset - current)
        range.collapse(true)
        placed = true
        return
      }
      current += text.length
      return
    }

    if (node.nodeName === 'BR') {
      if (current + 1 >= offset) {
        range.setStartBefore(node)
        range.collapse(true)
        placed = true
        return
      }
      current += 1
      return
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      if (el.dataset.mention) {
        const len = el.dataset.mention.length
        if (current + len >= offset) {
          if (offset <= current) {
            range.setStartBefore(el)
          }
          else {
            range.setStartAfter(el)
          }
          range.collapse(true)
          placed = true
          return
        }
        current += len
        return
      }

      for (const child of Array.from(node.childNodes))
        walk(child)
    }
  }

  for (const child of Array.from(root.childNodes))
    walk(child)

  if (!placed) {
    range.selectNodeContents(root)
    range.collapse(false)
  }

  selection.removeAllRanges()
  selection.addRange(range)
}

function createMediaChip(segment: PromptDisplaySegment & { type: 'image' | 'video' | 'audio' }): HTMLElement {
  const chip = document.createElement('span')
  chip.className = CHIP_CLASS
  if (segment.type === 'video')
    chip.classList.add('prompt-chip-video')
  if (segment.type === 'audio')
    chip.classList.add('prompt-chip-audio')
  chip.contentEditable = 'false'
  chip.dataset.mention = segment.label

  const thumb = document.createElement('span')
  thumb.className = 'prompt-chip-thumb'

  if (segment.type === 'image' && segment.imageUrl) {
    const img = document.createElement('img')
    img.src = segment.imageUrl
    img.alt = ''
    img.draggable = false
    thumb.appendChild(img)
  }
  else if (segment.type === 'video') {
    thumb.classList.add('prompt-chip-thumb-video')
    if (segment.mediaUrl) {
      const video = document.createElement('video')
      video.src = segment.mediaUrl
      video.muted = true
      video.playsInline = true
      video.preload = 'metadata'
      video.draggable = false
      thumb.appendChild(video)
    }
    else {
      thumb.textContent = '▶'
    }
  }
  else if (segment.type === 'audio') {
    thumb.classList.add('prompt-chip-thumb-audio')
    thumb.textContent = '♪'
  }

  const name = document.createElement('span')
  name.className = 'prompt-chip-name'
  name.textContent = segment.label

  chip.append(thumb, name)
  return chip
}

function appendTextWithBreaks(root: HTMLElement, text: string) {
  const parts = text.split('\n')
  parts.forEach((part, index) => {
    if (part)
      root.appendChild(document.createTextNode(part))
    if (index < parts.length - 1)
      root.appendChild(document.createElement('br'))
  })
}

export function renderPromptEditor(
  root: HTMLElement,
  text: string,
  refs: SeedanceUpstreamRefs,
) {
  root.innerHTML = ''

  if (!text) {
    root.appendChild(document.createElement('br'))
    return
  }

  const segments = splitPromptByMentions(text, refs)
  for (const segment of segments) {
    if (segment.type === 'text') {
      appendTextWithBreaks(root, segment.value)
      continue
    }

    root.appendChild(createMediaChip(segment))
  }
}

export function pastePlainTextAtSelection(text: string) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0)
    return

  selection.deleteFromDocument()
  const range = selection.getRangeAt(0)
  const lines = text.replace(/\r\n/g, '\n').split('\n')

  lines.forEach((line, index) => {
    if (line)
      range.insertNode(document.createTextNode(line))
    if (index < lines.length - 1)
      range.insertNode(document.createElement('br'))
  })

  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
}
