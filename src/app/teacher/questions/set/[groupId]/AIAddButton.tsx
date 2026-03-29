'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Loader2, Check, X, ChevronDown, ChevronUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { QUESTION_SUBTYPE_LABELS, usesAlphaOptions, optionLabel } from '@/lib/utils'

interface GeneratedQ {
  content: string
  passage?: string | null
  options: { num: number; text: string }[] | null
  answer: string
  explanation: string
  category: string
  difficulty: number
  question_subtype?: string | null
  vocab_words?: { word: string; def: string; example?: string }[] | null
}

interface Props {
  groupId: string
  passage: string | null
  category: string
  questionSubtype: string | null
  difficulty: number
}

export default function AIAddButton({ groupId, passage, category, questionSubtype, difficulty }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState<GeneratedQ[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [count, setCount] = useState(2)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0)
  const [error, setError] = useState('')

  async function handleGenerate() {
    setGenerating(true); setError(''); setGenerated([]); setSelected(new Set())
    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category,
        subtype: questionSubtype ?? 'academic_passage',
        difficulty,
        count: 1,               // 기존 지문 1개에 문제만 추가
        questionsPerPassage: count,  // 사용자가 선택한 개수만큼 문제 생성
        topic: '',
        passageContext: passage ?? '',
      }),
    })
    if (res.ok) {
      const data = await res.json()
      const qs: GeneratedQ[] = data.questions ?? []
      setGenerated(qs)
      setSelected(new Set(qs.map((_, i) => i)))
    } else {
      setError('AI 생성 실패. 다시 시도해주세요.')
    }
    setGenerating(false)
  }

  async function handleSave() {
    if (selected.size === 0) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const toSave = generated.filter((_, i) => selected.has(i)).map(q => ({
      teacher_id: user.id,
      type: 'multiple_choice',
      category: q.category,
      difficulty: q.difficulty,
      content: q.content,
      passage: q.passage ?? passage ?? null,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation ?? null,
      source: 'ai_generated',
      question_subtype: q.question_subtype ?? questionSubtype ?? null,
      passage_group_id: groupId,
      vocab_words: Array.isArray(q.vocab_words) && q.vocab_words.length > 0 ? q.vocab_words : null,
    }))

    const { error: dbError } = await supabase.from('questions').insert(toSave)
    if (dbError) {
      setError('저장 실패: ' + dbError.message)
    } else {
      setOpen(false)
      setGenerated([])
      // Short delay to let Supabase propagate the insert before refreshing server data
      await new Promise(r => setTimeout(r, 600))
      router.refresh()
    }
    setSaving(false)
  }

  const subtypeLabel = QUESTION_SUBTYPE_LABELS[category]?.[questionSubtype ?? ''] ?? questionSubtype ?? ''

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-bold rounded-xl hover:opacity-90 transition">
        <Sparkles size={14} /> AI 추가 문제 생성
      </button>

      {open && (
        <div className="mt-4 bg-purple-50 border border-purple-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-purple-800">
              AI 추가 문제 생성 — {subtypeLabel || category}
            </p>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-gray-600">생성 개수</label>
            {[1, 2, 3, 4].map(n => (
              <button key={n} type="button"
                onClick={() => setCount(n)}
                className={`w-8 h-8 rounded-lg text-sm font-bold border-2 transition ${count === n ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-200 text-gray-600 hover:border-purple-300'}`}>
                {n}
              </button>
            ))}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="ml-2 flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold transition">
              {generating ? <><Loader2 size={14} className="animate-spin" /> 생성 중...</> : <><Sparkles size={14} /> 생성</>}
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {generated.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-600">{generated.length}개 생성됨 — 저장할 문제를 선택하세요</p>
                <button
                  onClick={() => setSelected(new Set(generated.map((_, i) => i)))}
                  className="text-xs text-purple-600 font-semibold hover:underline">전체 선택</button>
              </div>
              {generated.map((q, i) => (
                <div key={i}
                  className={`bg-white rounded-xl border-2 transition ${selected.has(i) ? 'border-purple-400' : 'border-gray-100'}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(prev => {
                        const s = new Set(prev)
                        s.has(i) ? s.delete(i) : s.add(i)
                        return s
                      })
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left">
                    <div className={`w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 ${selected.has(i) ? 'bg-purple-600 border-purple-600' : 'border-gray-300'}`}>
                      {selected.has(i) && <Check size={12} className="text-white" />}
                    </div>
                    <p className="text-sm text-gray-800 flex-1 line-clamp-2">{q.content}</p>
                    <button type="button" onClick={e => { e.stopPropagation(); setExpandedIdx(expandedIdx === i ? null : i) }}
                      className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                      {expandedIdx === i ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </button>
                  {expandedIdx === i && q.options && (
                    <div className="px-4 pb-3 space-y-1.5 border-t border-gray-100 pt-2">
                      {q.options.map(opt => {
                        const alpha = usesAlphaOptions(q.category, q.question_subtype)
                        const isCorrect = String(opt.num) === q.answer
                        return (
                          <div key={opt.num} className={`flex items-start gap-2 text-xs p-2 rounded-lg ${isCorrect ? 'bg-emerald-50 text-emerald-800' : 'text-gray-600'}`}>
                            <span className={`font-bold flex-shrink-0 ${isCorrect ? 'text-emerald-600' : ''}`}>{optionLabel(opt.num, alpha)}.</span>
                            <span>{opt.text}</span>
                            {isCorrect && <span className="ml-auto text-emerald-600 font-bold flex-shrink-0">✓</span>}
                          </div>
                        )
                      })}
                      {q.explanation && <p className="text-[11px] text-gray-500 mt-1 pt-1 border-t border-gray-100">{q.explanation}</p>}
                    </div>
                  )}
                </div>
              ))}

              <button
                onClick={handleSave}
                disabled={saving || selected.size === 0}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold transition">
                {saving ? '저장 중...' : `선택한 ${selected.size}개 문제 세트에 추가`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
