'use client'

import { useRef } from 'react'
import { Underline } from 'lucide-react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  className?: string
}

export default function UnderlineTextarea({ value, onChange, placeholder, rows = 5, className }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function handleUnderline() {
    const el = ref.current
    if (!el) return

    const start = el.selectionStart
    const end = el.selectionEnd

    if (start === end) {
      alert('밑줄을 그을 텍스트를 먼저 선택하세요.')
      return
    }

    const selected = value.slice(start, end)
    const newValue = value.slice(0, start) + `<u>${selected}</u>` + value.slice(end)
    onChange(newValue)

    // 커서 위치 복원
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
        placeholder={placeholder}
        rows={rows}
        className={className ?? 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono'}
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
