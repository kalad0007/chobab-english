'use client'

import { useState } from 'react'
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react'

interface VocabWord {
  word: string
  pos?: string
  def: string
  example?: string
}

interface Props {
  words: VocabWord[]
  defaultOpen?: boolean
}

export default function VocabWords({ words, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  if (!words || words.length === 0) return null

  return (
    <div className="border border-indigo-100 rounded-2xl overflow-hidden mt-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition"
      >
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-indigo-600" />
          <span className="text-xs font-bold text-indigo-700">핵심 단어 {words.length}개</span>
        </div>
        {open ? <ChevronUp size={14} className="text-indigo-400" /> : <ChevronDown size={14} className="text-indigo-400" />}
      </button>
      {open && (
        <div className="divide-y divide-indigo-50 bg-white">
          {words.map((v, i) => (
            <div key={i} className="px-4 py-3 space-y-0.5">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-bold text-sm text-indigo-800">{v.word}</span>
                {v.pos && (
                  <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded">{v.pos}</span>
                )}
                <span className="text-xs text-gray-500">{v.def}</span>
              </div>
              {v.example && (
                <p className="text-xs text-gray-400 italic pl-1">"{v.example}"</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
