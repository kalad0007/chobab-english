'use client'

import { useRef } from 'react'
import type { Annotation } from './actions'

// ── Shared types ──────────────────────────────────────────
export interface ParagraphState {
  id: string
  text: string
  text_ko: string
  explanation: string
  annotations: Annotation[]
  mode: 'edit' | 'annotate'
  translating: boolean
}

export interface Toolbar {
  x: number; y: number
  paraId: string; start: number; end: number
  step: 'main' | 'vocab'
}

export interface VocabWord {
  id: string; word: string; definition_ko: string; definition_en: string; synonyms: string[]
}

// ── Shared constants ──────────────────────────────────────
export const DIFFICULTY_OPTIONS = [
  { value: 2.0, label: 'Band 2.0 (A2)' }, { value: 2.5, label: 'Band 2.5 (B1-)' },
  { value: 3.0, label: 'Band 3.0 (B1)' }, { value: 3.5, label: 'Band 3.5 (B1+)' },
  { value: 4.0, label: 'Band 4.0 (B2)' }, { value: 4.5, label: 'Band 4.5 (B2+)' },
  { value: 5.0, label: 'Band 5.0 (C1)' },
]

export function uid() { return Math.random().toString(36).slice(2) }

// ── DOM utility ───────────────────────────────────────────
export function getTextOffset(container: Node, targetNode: Node, targetOffset: number): number {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let total = 0
  let node = walker.nextNode()
  while (node) {
    if (node === targetNode) return total + targetOffset
    total += node.textContent?.length ?? 0
    node = walker.nextNode()
  }
  return total + targetOffset
}

// ── Annotation rendering ──────────────────────────────────
export function renderParts(text: string, annotations: Annotation[]) {
  const sorted = [...annotations].sort((a, b) => a.start - b.start)
  const parts: Array<{ type: string; text: string; ann?: Annotation }> = []
  let pos = 0
  for (const ann of sorted) {
    if (ann.start < pos) continue
    if (ann.start > pos) parts.push({ type: 'plain', text: text.slice(pos, ann.start) })
    parts.push({ type: ann.type, text: text.slice(ann.start, ann.end), ann })
    pos = ann.end
  }
  if (pos < text.length) parts.push({ type: 'plain', text: text.slice(pos) })
  return parts
}

// ── AnnotatedView component ───────────────────────────────
export function AnnotatedView({
  para,
  onMouseUp,
}: {
  para: ParagraphState
  onMouseUp: (paraId: string, start: number, end: number, x: number, y: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  function handleMouseUp() {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.rangeCount || !ref.current) return
    const range = sel.getRangeAt(0)
    const start = getTextOffset(ref.current, range.startContainer, range.startOffset)
    const end = getTextOffset(ref.current, range.endContainer, range.endOffset)
    if (start >= end) return
    const rect = range.getBoundingClientRect()
    onMouseUp(para.id, start, end, rect.left + rect.width / 2, rect.top - 8)
  }

  const parts = renderParts(para.text, para.annotations)

  return (
    <div
      ref={ref}
      onMouseUp={handleMouseUp}
      className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm leading-relaxed text-gray-800 select-text cursor-text min-h-[80px]"
    >
      {parts.map((p, i) => {
        if (p.type === 'plain') return <span key={i}>{p.text}</span>
        if (p.type === 'highlight') return <mark key={i} className="bg-yellow-300 rounded px-0.5">{p.text}</mark>
        if (p.type === 'chunk') return (
          <span key={i}>
            <span className="bg-sky-100 text-sky-800 rounded px-0.5">{p.text}</span>
            <span className="text-gray-400 font-bold mx-1 select-none">/</span>
          </span>
        )
        if (p.type === 'vocab') return (
          <span key={i} className="text-purple-700 underline underline-offset-2 decoration-dotted cursor-pointer">
            {p.text}
          </span>
        )
        return <span key={i}>{p.text}</span>
      })}
      {para.text.length === 0 && (
        <span className="text-gray-300 italic">본문을 입력한 뒤 주석 모드를 사용하세요</span>
      )}
    </div>
  )
}
