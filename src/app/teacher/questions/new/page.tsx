'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS } from '@/lib/utils'
import { Plus, Trash2 } from 'lucide-react'
import UnderlineTextarea from '@/components/ui/UnderlineTextarea'

export default function NewQuestionPage() {
  const router = useRouter()
  const supabase = createClient()

  const [type, setType] = useState<'multiple_choice' | 'short_answer' | 'essay'>('multiple_choice')
  const [category, setCategory] = useState('grammar')
  const [subcategory, setSubcategory] = useState('')
  const [difficulty, setDifficulty] = useState(3)
  const [content, setContent] = useState('')
  const [passage, setPassage] = useState('')
  const [options, setOptions] = useState([
    { num: 1, text: '' }, { num: 2, text: '' }, { num: 3, text: '' },
    { num: 4, text: '' }, { num: 5, text: '' },
  ])
  const [answer, setAnswer] = useState('')
  const [explanation, setExplanation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: dbError } = await supabase.from('questions').insert({
      teacher_id: user.id,
      type,
      category,
      subcategory: subcategory || null,
      difficulty,
      content,
      passage: passage || null,
      options: type === 'multiple_choice' ? options.filter(o => o.text.trim()) : null,
      answer,
      explanation: explanation || null,
      source: 'teacher',
    })

    if (dbError) {
      setError('저장에 실패했습니다.')
      setLoading(false)
      return
    }

    router.push('/teacher/questions')
    router.refresh()
  }

  return (
    <div className="p-7 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">✏️ 문제 직접 출제</h1>
        <p className="text-gray-500 text-sm mt-1">새 문제를 문제은행에 추가합니다</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">{error}</div>}

        {/* 기본 설정 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-900">기본 설정</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">문제 유형</label>
              <select value={type} onChange={e => setType(e.target.value as typeof type)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="multiple_choice">객관식</option>
                <option value="short_answer">단답형</option>
                <option value="essay">서술형</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">영역</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">난이도</label>
              <div className="flex gap-1 mt-1">
                {[1,2,3,4,5].map(d => (
                  <button key={d} type="button" onClick={() => setDifficulty(d)}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${d <= difficulty ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-400'}`}>
                    ★
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">세부 유형 (선택)</label>
            <input value={subcategory} onChange={e => setSubcategory(e.target.value)}
              placeholder="예: tense, synonym, main_idea..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* 지문 (독해 유형) */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-900">지문 (선택)</h2>
          <UnderlineTextarea
            value={passage}
            onChange={setPassage}
            placeholder="독해 지문이 있으면 여기에 입력하세요..."
            rows={5}
          />
        </div>

        {/* 문제 본문 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-900">문제</h2>
          <textarea value={content} onChange={e => setContent(e.target.value)}
            placeholder="문제를 입력하세요..."
            rows={4} required
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />

          {/* 객관식 보기 */}
          {type === 'multiple_choice' && (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">보기</label>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full text-xs font-bold text-gray-600 flex-shrink-0">
                    {opt.num}
                  </span>
                  <input
                    value={opt.text}
                    onChange={e => {
                      const next = [...options]
                      next[i] = { ...next[i], text: e.target.value }
                      setOptions(next)
                    }}
                    placeholder={`보기 ${opt.num}`}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          )}

          {/* 정답 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              {type === 'multiple_choice' ? '정답 번호' : '정답'}
            </label>
            <input
              value={answer} onChange={e => setAnswer(e.target.value)}
              placeholder={type === 'multiple_choice' ? '예: 2' : '정답을 입력하세요'}
              required
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 해설 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 mb-3">해설 (선택)</h2>
          <textarea value={explanation} onChange={e => setExplanation(e.target.value)}
            placeholder="정답 해설을 입력하면 학생들에게 도움이 돼요..."
            rows={3}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()}
            className="px-6 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
            취소
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-3 rounded-xl transition text-sm">
            {loading ? '저장 중...' : '문제 저장'}
          </button>
        </div>
      </form>
    </div>
  )
}
