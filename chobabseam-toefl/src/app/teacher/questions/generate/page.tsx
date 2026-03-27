'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORY_LABELS } from '@/lib/utils'
import { Sparkles, Check, Loader2 } from 'lucide-react'

interface GeneratedQuestion {
  content: string
  passage?: string | null
  options: { num: number; text: string }[] | null
  answer: string
  explanation: string
  category: string
  difficulty: number
  speaking_prompt?: string | null
  audio_script?: string | null
}

export default function GenerateQuestionsPage() {
  const router = useRouter()
  const [category, setCategory] = useState('reading')
  const [difficulty, setDifficulty] = useState(3)
  const [count, setCount] = useState(3)
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setQuestions([])
    setSelected(new Set())

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, difficulty, count, topic }),
      })

      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setQuestions(data.questions)
      setSelected(new Set(data.questions.map((_: GeneratedQuestion, i: number) => i)))
    } catch {
      setError('문제 생성에 실패했어요. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    const toSave = questions.filter((_, i) => selected.has(i))

    const res = await fetch('/api/ai/save-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: toSave }),
    })

    if (res.ok) {
      router.push('/teacher/questions')
      router.refresh()
    } else {
      setError('저장에 실패했습니다.')
    }
    setSaving(false)
  }

  return (
    <div className="p-7 max-w-3xl">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-bold mb-3">
          <Sparkles size={14} /> AI 문제 생성
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900">AI로 TOEFL 문제 생성</h1>
        <p className="text-gray-500 text-sm mt-1">Claude AI가 TOEFL iBT 형식 문제를 생성해드려요. 생성 후 직접 선택해 저장하세요.</p>
      </div>

      {/* 생성 옵션 폼 */}
      <form onSubmit={handleGenerate} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">TOEFL 섹션</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">문제 개수</label>
            <select value={count} onChange={e => setCount(Number(e.target.value))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              {[1,2,3,5,10].map(n => <option key={n} value={n}>{n}개</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">난이도 (TOEFL 예상 점수대)</label>
          <div className="flex gap-1">
            {[
              { d: 1, label: '50-60' },
              { d: 2, label: '60-80' },
              { d: 3, label: '80-90' },
              { d: 4, label: '90-100' },
              { d: 5, label: '100+' },
            ].map(({ d, label }) => (
              <button key={d} type="button" onClick={() => setDifficulty(d)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${d <= difficulty ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">주제/키워드 (선택)</label>
          <input value={topic} onChange={e => setTopic(e.target.value)}
            placeholder="예: 생태학, 천문학, 미국 역사, 캠퍼스 생활..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
        </div>

        {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">{error}</div>}

        <button type="submit" disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition text-sm shadow-md">
          {loading ? <><Loader2 size={16} className="animate-spin" /> 생성 중...</> : <><Sparkles size={16} /> 문제 생성하기</>}
        </button>
      </form>

      {/* 생성된 문제 목록 */}
      {questions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900">{questions.length}개 문제 생성됨</h2>
            <button
              onClick={() => setSelected(selected.size === questions.length ? new Set() : new Set(questions.map((_, i) => i)))}
              className="text-sm text-blue-600 font-medium hover:underline"
            >
              {selected.size === questions.length ? '전체 해제' : '전체 선택'}
            </button>
          </div>

          <div className="space-y-3 mb-5">
            {questions.map((q, i) => (
              <div
                key={i}
                onClick={() => {
                  const next = new Set(selected)
                  if (next.has(i)) next.delete(i)
                  else next.add(i)
                  setSelected(next)
                }}
                className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition ${selected.has(i) ? 'border-purple-500 bg-purple-50' : 'border-gray-100 hover:border-gray-200'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${selected.has(i) ? 'bg-purple-600' : 'bg-gray-200'}`}>
                    {selected.has(i) && <Check size={12} className="text-white" />}
                  </div>
                  <div className="flex-1">
                    {q.passage && (
                      <div className="bg-gray-50 border-l-2 border-blue-400 p-3 rounded text-xs text-gray-600 mb-3 line-clamp-3">
                        {q.passage}
                      </div>
                    )}
                    <p className="text-sm font-semibold text-gray-800 mb-2">{q.content}</p>
                    {q.options?.map(opt => (
                      <p key={opt.num} className="text-xs text-gray-600 py-0.5">
                        <span className="font-semibold">{opt.num}.</span> {opt.text}
                      </p>
                    ))}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-green-700 font-semibold bg-green-50 px-2 py-0.5 rounded">정답: {q.answer}</span>
                      {q.explanation && <span className="text-xs text-gray-400 line-clamp-1">{q.explanation}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleSave}
            disabled={saving || selected.size === 0}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-3 rounded-xl transition text-sm"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> 저장 중...</> : `선택한 ${selected.size}개 문제 저장`}
          </button>
        </div>
      )}
    </div>
  )
}
