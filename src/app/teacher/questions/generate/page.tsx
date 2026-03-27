'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORY_LABELS, DIFFICULTY_LEVELS, usesAlphaOptions, optionLabel } from '@/lib/utils'
import { Sparkles, Check, Loader2 } from 'lucide-react'

interface GeneratedQuestion {
  content: string
  passage?: string | null
  options: { num: number; text: string }[] | null
  answer: string
  explanation: string
  category: string
  difficulty: number
  question_subtype?: string | null
  speaking_prompt?: string | null
  audio_script?: string | null
}

const SUBTYPE_OPTIONS: Record<string, { value: string; label: string; desc: string; badge: string }[]> = {
  reading: [
    { value: 'complete_the_words', label: 'Complete the Words', desc: '단락형 빈칸 — 지문 속 단어 뒷부분 마스킹', badge: 'bg-teal-100 text-teal-700' },
    { value: 'sentence_completion', label: 'Sentence Completion', desc: '독립 문장 빈칸 — 짧은 문장, 각 1개 빈칸', badge: 'bg-blue-100 text-blue-700' },
    { value: 'daily_life_email', label: 'Daily Life — Email', desc: '이메일 형식 실용문 + 독해 문제', badge: 'bg-cyan-100 text-cyan-700' },
    { value: 'daily_life_text_chain', label: 'Daily Life — Text Chain', desc: '그룹 채팅 형식 (3-4명) + 독해 문제', badge: 'bg-sky-100 text-sky-700' },
    { value: 'academic_passage', label: 'Academic Passage', desc: '200-300단어 학술 지문 + 여러 문제 세트', badge: 'bg-indigo-100 text-indigo-700' },
  ],
  listening: [
    { value: 'choose_response', label: 'Choose a Response', desc: '짧은 한마디 듣고 적절한 대답 선택', badge: 'bg-emerald-100 text-emerald-700' },
    { value: 'conversation', label: 'Conversation', desc: '두 사람의 캠퍼스 일상 대화 + 문제 세트', badge: 'bg-green-100 text-green-700' },
    { value: 'academic_talk', label: 'Academic Talk', desc: '교수/강연자 학술 강의 + 문제 세트', badge: 'bg-lime-100 text-lime-700' },
  ],
  writing: [
    { value: 'sentence_reordering', label: 'Build a Sentence', desc: '단어 칩 배열 → 올바른 문장 완성', badge: 'bg-purple-100 text-purple-700' },
    { value: 'email_writing', label: 'Write an Email', desc: '상황 + 조건 3가지 → 이메일 쓰기', badge: 'bg-violet-100 text-violet-700' },
    { value: 'academic_discussion', label: 'Write for an Academic Discussion', desc: '교수 질문 + 학생 2명 의견 → 토론 참여', badge: 'bg-rose-100 text-rose-700' },
  ],
  speaking: [
    { value: 'listen_and_repeat', label: 'Listen and Repeat', desc: '원어민 문장 듣고 그대로 따라 말하기', badge: 'bg-orange-100 text-orange-700' },
    { value: 'take_an_interview', label: 'Take an Interview', desc: '면접관 질문 → 논리적 답변하기', badge: 'bg-amber-100 text-amber-700' },
  ],
}

const MULTI_QPP_SUBTYPES = ['daily_life_email', 'daily_life_text_chain', 'academic_passage', 'conversation', 'academic_talk']

export default function GenerateQuestionsPage() {
  const router = useRouter()
  const [category, setCategory] = useState('reading')
  const [subtype, setSubtype] = useState<string | null>(null)
  const [difficulty, setDifficulty] = useState(3.0)
  const [count, setCount] = useState(3)
  const [questionsPerPassage, setQuestionsPerPassage] = useState(3)
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')

  function handleCategoryChange(newCat: string) {
    setCategory(newCat)
    setSubtype(null)
    setQuestions([])
    setSelected(new Set())
  }

  function handleSubtypeToggle(val: string) {
    setSubtype(prev => (prev === val ? null : val))
  }

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
        body: JSON.stringify({ category, subtype, difficulty, count, topic, questionsPerPassage: isMultiQpp ? questionsPerPassage : 1 }),
      })

      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setQuestions(data.questions)
      setSelected(new Set(data.questions.map((_: GeneratedQuestion, i: number) => i)))
    } catch (err) {
      setError('문제 생성 실패: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    const toSave = questions.filter((_, i) => selected.has(i))

    try {
      const res = await fetch('/api/ai/save-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: toSave }),
      })
      if (res.ok) {
        router.push('/teacher/questions')
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setError('저장에 실패했습니다: ' + (data.error ?? '알 수 없는 오류'))
      }
    } catch {
      setError('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const subtypeList = SUBTYPE_OPTIONS[category] ?? []
  const selectedSubtypeInfo = subtypeList.find(s => s.value === subtype)
  const isMultiQpp = subtype !== null && MULTI_QPP_SUBTYPES.includes(subtype)

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
      <form onSubmit={handleGenerate} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 space-y-5">

        {/* 섹션 선택 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">TOEFL 섹션</label>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <button key={k} type="button" onClick={() => handleCategoryChange(k)}
                className={`py-2.5 rounded-xl text-sm font-bold transition ${
                  category === k
                    ? k === 'reading' ? 'bg-blue-600 text-white'
                      : k === 'listening' ? 'bg-emerald-600 text-white'
                      : k === 'writing' ? 'bg-purple-600 text-white'
                      : 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* 세부 유형 카드 */}
        {subtypeList.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              문제 유형 <span className="text-xs font-normal text-gray-400">(선택 — 미선택 시 학술 지문으로 생성)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {subtypeList.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSubtypeToggle(opt.value)}
                  className={`text-left p-3 rounded-xl border-2 transition ${
                    subtype === opt.value
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-100 hover:border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`flex-1 min-w-0`}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${opt.badge}`}>
                          {opt.label}
                        </span>
                        {subtype === opt.value && (
                          <span className="w-4 h-4 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <Check size={10} className="text-white" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{opt.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {selectedSubtypeInfo && (
              <p className="text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 mt-2">
                선택: <strong>{selectedSubtypeInfo.label}</strong> — {selectedSubtypeInfo.desc}
              </p>
            )}
          </div>
        )}

        {/* 난이도 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            난이도 (10단계 정밀 그리드)
            <span className="ml-2 text-xs font-normal text-gray-400">
              {DIFFICULTY_LEVELS.find(l => l.value === difficulty)?.level} · Band {difficulty}
            </span>
          </label>
          <div className="flex flex-wrap gap-1">
            {DIFFICULTY_LEVELS.map(l => (
              <button key={l.value} type="button" onClick={() => setDifficulty(l.value)}
                title={`${l.name} (${l.cefr})`}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex flex-col items-center gap-0.5 min-w-[3rem] ${
                  l.value === difficulty
                    ? `${l.color} ring-2 ring-blue-400`
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                }`}>
                <span>{l.level}</span>
                <span className="text-[9px] font-normal">{l.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 문제 개수 + 주제 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              {isMultiQpp ? '문제 Set 개수' : '문제 개수'}
            </label>
            <select value={count} onChange={e => setCount(Number(e.target.value))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              {(isMultiQpp ? [1, 2, 3, 5] : [1, 2, 3, 5, 10]).map(n => <option key={n} value={n}>{n}개</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">주제/키워드 (선택)</label>
            <input value={topic} onChange={e => setTopic(e.target.value)}
              placeholder="예: 생태학, 천문학, 캠퍼스 생활..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
        </div>

        {/* 지문당 문제 개수 (multi-QPP subtypes only) */}
        {isMultiQpp && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              지문당 문제 개수
              <span className="ml-2 text-xs font-normal text-gray-400">총 {count * questionsPerPassage}개 문제 생성</span>
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5, 6].map(n => (
                <button key={n} type="button" onClick={() => setQuestionsPerPassage(n)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition ${
                    questionsPerPassage === n
                      ? 'bg-purple-600 border-purple-600 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-purple-300'
                  }`}>
                  {n}개
                </button>
              ))}
            </div>
          </div>
        )}

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
            {questions.map((q, i) => {
              const subtypeInfo = Object.values(SUBTYPE_OPTIONS).flat().find(s => s.value === q.question_subtype)
              return (
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
                    <div className="flex-1 min-w-0 overflow-hidden">
                      {subtypeInfo && (
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-semibold mb-2 ${subtypeInfo.badge}`}>
                          {subtypeInfo.label}
                        </span>
                      )}
                      {q.passage && (
                        <div className="bg-gray-50 border-l-2 border-blue-400 p-3 rounded text-xs text-gray-600 mb-3 line-clamp-3">
                          {q.passage}
                        </div>
                      )}
                      {q.audio_script && !q.passage && (
                        <div className="bg-emerald-50 border-l-2 border-emerald-400 p-3 rounded text-xs text-gray-600 mb-3 line-clamp-3">
                          {q.audio_script}
                        </div>
                      )}
                      <p className="text-sm font-semibold text-gray-800 mb-2 break-words">{q.content}</p>
                      {q.options?.map(opt => (
                        <p key={opt.num} className="text-xs text-gray-600 py-0.5">
                          <span className="font-semibold">{optionLabel(opt.num, usesAlphaOptions(q.category, q.question_subtype))}.</span> {opt.text}
                        </p>
                      ))}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-green-700 font-semibold bg-green-50 px-2 py-0.5 rounded break-all line-clamp-2">정답: {q.answer}</span>
                        {q.explanation && <span className="text-xs text-gray-400 line-clamp-2 break-words">{q.explanation}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
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
