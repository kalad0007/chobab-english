'use client'

import { useRef, useEffect, useState } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  className?: string
}

export default function UnderlineTextarea({ value, onChange, placeholder, rows = 3, className }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [savedSel, setSavedSel] = useState<[number, number] | null>(null)

  // 자동 높이
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [value])

  function applyTag(tag: string) {
    const el = ref.current
    if (!el) return

    const start = savedSel?.[0] ?? el.selectionStart
    const end   = savedSel?.[1] ?? el.selectionEnd

    if (start === end) {
      alert('서식을 적용할 텍스트를 먼저 선택하세요.')
      return
    }

    const open  = `<${tag}>`
    const close = `</${tag}>`
    const selected = value.slice(start, end)

    let next: string
    let newStart: number
    let newEnd: number

    if (selected.startsWith(open) && selected.endsWith(close)) {
      // 이미 적용된 경우 → 제거(토글)
      const inner = selected.slice(open.length, selected.length - close.length)
      next = value.slice(0, start) + inner + value.slice(end)
      newStart = start
      newEnd   = start + inner.length
    } else {
      next = value.slice(0, start) + open + selected + close + value.slice(end)
      newStart = start + open.length
      newEnd   = end + open.length
    }

    onChange(next)
    setSavedSel(null)
    setTimeout(() => { el.focus(); el.setSelectionRange(newStart, newEnd) }, 0)
  }

  function saveSel(t: HTMLTextAreaElement) {
    if (t.selectionStart !== t.selectionEnd) setSavedSel([t.selectionStart, t.selectionEnd])
  }

  const hasHtml = value.includes('<u>') || value.includes('<b>')

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        {/* Bold 버튼 */}
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={() => applyTag('b')}
          title="볼드"
          className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-700 text-sm font-extrabold"
        >
          B
        </button>
        {/* Underline 버튼 */}
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={() => applyTag('u')}
          title="밑줄"
          className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-700"
        >
          <span className="text-sm font-bold underline leading-none">U</span>
        </button>
        <span className="text-xs text-gray-400">← 단어 선택 후 클릭</span>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        onSelect={e => saveSel(e.currentTarget)}
        onBlur={e => saveSel(e.currentTarget)}
        placeholder={placeholder}
        rows={rows}
        style={{ overflow: 'hidden', resize: 'none' }}
        className={className ?? 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono'}
      />
      {hasHtml && (
        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
          <span className="font-semibold">미리보기:</span>{' '}
          <span dangerouslySetInnerHTML={{ __html: value.replace(/\n/g, ' ') }} />
        </div>
      )}
    </div>
  )
}
