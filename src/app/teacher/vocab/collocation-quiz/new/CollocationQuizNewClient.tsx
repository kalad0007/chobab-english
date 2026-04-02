'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Zap, Check } from 'lucide-react'
import { createCollocationQuiz } from '../../collocation-quiz-actions'

interface Props {
  set: { id: string; title: string; word_count: number }
  words: { id: string; word: string; part_of_speech: string; collocations: string[] }[]
  allClasses: { id: string; name: string }[]
}

function extractPartner(word: string, collocation: string): string {
  return collocation.replace(new RegExp(`\\b${word}\\b`, 'gi'), '').replace(/\s+/g, ' ').trim()
}

type ItemKey = `${string}::${string}` // wordId::collocation

export default function CollocationQuizNewClient({ set, words, allClasses }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [title, setTitle] = useState(`${set.title} - 스와이프 퀴즈`)
  const [orderNum, setOrderNum] = useState(0)
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set())
  const [selectedItems, setSelectedItems] = useState<Set<ItemKey>>(new Set())
  const [error, setError] = useState<string | null>(null)

  // 전체 아이템 목록
  const allItems: ItemKey[] = words.flatMap(w =>
    w.collocations.map(c => `${w.id}::${c}` as ItemKey)
  )

  const allSelected = allItems.length > 0 && allItems.every(k => selectedItems.has(k))

  function toggleAll() {
    if (allSelected) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(allItems))
    }
  }

  function toggleItem(key: ItemKey) {
    setSelectedItems(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleClass(id: string) {
    setSelectedClassIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSubmit() {
    setError(null)
    if (!title.trim()) { setError('퀴즈 제목을 입력해주세요.'); return }
    if (selectedItems.size === 0) { setError('최소 1개 이상의 연어 항목을 선택해주세요.'); return }

    const items = Array.from(selectedItems).map((key, idx) => {
      const [wordId, collocation] = key.split('::') as [string, string]
      return { wordId, collocation, orderNum: idx }
    })

    startTransition(async () => {
      const result = await createCollocationQuiz({
        setId: set.id,
        title: title.trim(),
        orderNum,
        classIds: Array.from(selectedClassIds),
        items,
      })
      if (result.error) {
        setError(result.error)
      } else {
        router.push('/teacher/vocab/collocation-quiz')
      }
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* 상단 헤더 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push('/teacher/vocab/collocation-quiz')}
            className="p-2 rounded-lg hover:bg-gray-100 transition"
          >
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-base font-bold text-gray-900">새 스와이프 퀴즈</h1>
            <p className="text-xs text-gray-500">{set.title} · {set.word_count}단어</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {/* 퀴즈 제목 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">퀴즈 제목</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            placeholder="퀴즈 제목을 입력하세요"
          />
        </div>

        {/* 레벨 순서 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">레벨 순서</label>
            <input
              type="number"
              min={0}
              value={orderNum}
              onChange={e => setOrderNum(Number(e.target.value))}
              className="w-24 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <p className="text-xs text-gray-400 mt-1">낮을수록 먼저 표시됩니다 (0부터 시작)</p>
          </div>
        </div>

        {/* 반 선택 */}
        {allClasses.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              배포할 반 선택 <span className="text-xs font-normal text-gray-400">(미선택 시 임시저장)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {allClasses.map(c => {
                const selected = selectedClassIds.has(c.id)
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleClass(c.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition min-h-[44px] ${
                      selected
                        ? 'bg-purple-100 border-purple-400 text-purple-800'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-purple-300'
                    }`}
                  >
                    {selected && <Check size={13} />}
                    {c.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 연어 아이템 선택 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-gray-700">
              연어 항목 선택
              <span className="ml-2 text-xs font-normal text-gray-400">
                {selectedItems.size}/{allItems.length}개 선택
              </span>
            </label>
            <button
              onClick={toggleAll}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition"
            >
              {allSelected ? '전체 해제' : '전체 선택'}
            </button>
          </div>

          {words.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              이 세트에 연어가 있는 단어가 없습니다.
            </p>
          ) : (
            <div className="space-y-4">
              {words.map(w => (
                <div key={w.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-gray-900 text-sm">{w.word}</span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">
                      {w.part_of_speech}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {w.collocations.map(col => {
                      const key: ItemKey = `${w.id}::${col}`
                      const checked = selectedItems.has(key)
                      const partner = extractPartner(w.word, col)
                      return (
                        <label
                          key={col}
                          className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition ${
                            checked ? 'bg-purple-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleItem(key)}
                            className="mt-0.5 accent-purple-600 w-4 h-4 flex-shrink-0"
                          />
                          <div className="text-xs text-gray-700 leading-relaxed">
                            <span className="text-gray-400 mr-1">카드:</span>
                            <strong>{w.word}</strong>
                            <span className="mx-1.5 text-gray-300">|</span>
                            <span className="text-gray-400 mr-1">정답:</span>
                            <strong>{partner || col}</strong>
                            <span className="ml-1.5 text-gray-400 text-[11px]">({col})</span>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 에러 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* 하단 고정 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 safe-area-inset-bottom">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleSubmit}
            disabled={isPending || selectedItems.size === 0}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3.5 rounded-xl transition text-sm min-h-[52px]"
          >
            <Zap size={16} />
            {isPending
              ? '생성 중...'
              : `퀴즈 만들기 · ${selectedItems.size}개 항목`}
          </button>
        </div>
      </div>
    </div>
  )
}
