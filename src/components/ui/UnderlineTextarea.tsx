'use client'

import { useRef, useEffect, useState } from 'react'
import { Underline } from 'lucide-react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  className?: string
}

export default function UnderlineTextarea({ value, onChange, placeholder, rows = 3, className }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  // 모바일: 버튼 탭 시 blur → selectionStart/End 초기화되기 전에 저장
  const [savedSel, setSavedSel] = useState<[number, number] | null>(null)

  // 자동 높이 조절
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [value])

  function handleUnderline() {
    const el = ref.current
    if (!el) return

    // 저장된 selection 우선 (모바일 blur 후), 없으면 현재 selection (데스크톱)
    const start = savedSel?.[0] ?? el.selectionStart
    const end   = savedSel?.[1] ?? el.selectionEnd

    if (start === end) {
      alert('밑줄을 그을 텍스트를 먼저 선택하세요.')
      return
    }

    const selected = value.slice(start, end)
    onChange(value.slice(0, start) + `<u>${selected}</u>` + value.slice(end))
    setSavedSel(null)

    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + 3, end + 3)
    }, 0)
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          // 데스크톱: mousedown preventDefault → textarea 포커스 유지 → selectionStart/End 그대로
          onMouseDown={e => e.preventDefault()}
          onClick={handleUnderline}
          title="선택한 텍스트에 밑줄 추가"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600"
        >
          <Underline size={13} />
          밑줄
        </button>
        <span className="text-xs text-gray-400">텍스트 선택 후 클릭하면 밑줄이 추가됩니다</span>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        // 텍스트 선택 중 저장 (데스크톱 드래그)
        onSelect={e => {
          const t = e.currentTarget
          if (t.selectionStart !== t.selectionEnd) setSavedSel([t.selectionStart, t.selectionEnd])
        }}
        // 모바일 핵심: blur 시점에 selection 저장 (이때는 아직 selectionStart/End 접근 가능)
        onBlur={e => {
          const t = e.currentTarget
          if (t.selectionStart !== t.selectionEnd) setSavedSel([t.selectionStart, t.selectionEnd])
        }}
        placeholder={placeholder}
        rows={rows}
        style={{ overflow: 'hidden', resize: 'none' }}
        className={className ?? 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono'}
      />
      {value.includes('<u>') && (
        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
          <span className="font-semibold">미리보기:</span>{' '}
          <span dangerouslySetInnerHTML={{ __html: value.replace(/\n/g, ' ') }} />
        </div>
      )}
    </div>
  )
}
