'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Zap } from 'lucide-react'

interface Word {
  id: string
  word: string
  part_of_speech: string
  definition_ko: string
  collocations: string[]
  topic_category: string
  difficulty: number
}

interface Props {
  words: Word[]
}

export default function WordPickerClient({ words }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filtered = words.filter(w =>
    w.word.toLowerCase().includes(search.toLowerCase())
  )

  function toggleWord(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleConfirm() {
    if (selected.size === 0) return
    const ids = [...selected].join(',')
    router.push(`/teacher/vocab/collocation-quiz/new?mode=words&wordIds=${ids}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* 검색 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="단어 검색..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-gray-50"
          />
        </div>
      </div>

      {/* 단어 목록 */}
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-2">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-16">검색 결과가 없습니다.</p>
        ) : (
          filtered.map(w => {
            const isSelected = selected.has(w.id)
            return (
              <label
                key={w.id}
                className={`flex items-start gap-3 bg-white rounded-xl border-2 p-4 cursor-pointer transition ${
                  isSelected ? 'border-purple-400 bg-purple-50' : 'border-gray-100 hover:border-purple-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleWord(w.id)}
                  className="mt-0.5 accent-purple-600 w-4 h-4 flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900 text-sm">{w.word}</span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">
                      {w.part_of_speech}
                    </span>
                    <span className="flex items-center gap-0.5 text-xs font-bold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">
                      <Zap size={10} />
                      {w.collocations.length}개
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{w.definition_ko}</p>
                </div>
              </label>
            )
          })
        )}
      </div>

      {/* 하단 고정 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 safe-area-inset-bottom">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3.5 rounded-xl transition text-sm min-h-[52px]"
          >
            {selected.size === 0
              ? '단어를 선택하세요'
              : `${selected.size}개 단어 선택됨 → 퀴즈 만들기`}
          </button>
        </div>
      </div>
    </div>
  )
}
