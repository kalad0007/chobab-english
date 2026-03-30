'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORY_LABELS, DIFFICULTY_LEVELS, usesAlphaOptions, optionLabel } from '@/lib/utils'
import { Sparkles, Check, Loader2, Volume2 } from 'lucide-react'

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

// Reading 상위 유형 (Daily Life는 하위 선택 있음)
const READING_TOP_TYPES = [
  { value: 'complete_the_words',  label: '1-1A · Complete the Words',  desc: '지문 속 단어 뒷부분 마스킹 (단락형 빈칸)', badge: 'bg-teal-100 text-teal-700' },
  { value: 'sentence_completion', label: '1-1B · Sentence Completion',  desc: '독립 문장 1개에 빈칸 1개 (문법/어휘)', badge: 'bg-blue-100 text-blue-700' },
  { value: 'daily_life',          label: '1-2 · Daily Life',            desc: '이메일·문자·공지·가이드·기사·학교공지 6가지 형식 + MCQ', badge: 'bg-cyan-100 text-cyan-700' },
  { value: 'academic_passage',    label: '1-3 · Academic Passage',      desc: '200-300단어 학술 지문 + 여러 문제 세트', badge: 'bg-indigo-100 text-indigo-700' },
]

// Daily Life 하위 형식
const DAILY_LIFE_FORMATS = [
  { value: 'daily_life_email',         label: 'Email',          desc: '격식 이메일 (From/To/Subject)', badge: 'bg-cyan-100 text-cyan-700' },
  { value: 'daily_life_text_chain',    label: 'Text Chain',     desc: '그룹 채팅 (3-4명, 타임스탬프)', badge: 'bg-sky-100 text-sky-700' },
  { value: 'daily_life_notice',        label: 'Notice',         desc: '공지문 (공식 안내/규정)', badge: 'bg-cyan-100 text-cyan-700' },
  { value: 'daily_life_guide',         label: 'Guide',          desc: '가이드/매뉴얼 (단계별 안내)', badge: 'bg-sky-100 text-sky-700' },
  { value: 'daily_life_article',       label: 'Article',        desc: '짧은 기사 (뉴스/잡지)', badge: 'bg-cyan-100 text-cyan-700' },
  { value: 'daily_life_campus_notice', label: 'Campus Notice',  desc: '학교 공지문 (학사/행사)', badge: 'bg-sky-100 text-sky-700' },
]

const SUBTYPE_OPTIONS: Record<string, { value: string; label: string; desc: string; badge: string }[]> = {
  reading: [], // Reading은 READING_TOP_TYPES + DAILY_LIFE_FORMATS로 별도 처리
  listening: [
    { value: 'choose_response',    label: 'Choose a Response',  desc: '짧은 한마디 듣고 적절한 대답 선택',       badge: 'bg-emerald-100 text-emerald-700' },
    { value: 'conversation',       label: 'Conversation',        desc: '두 사람의 캠퍼스 일상 대화 + 문제 세트', badge: 'bg-green-100 text-green-700' },
    { value: 'campus_announcement', label: 'Campus Announcement', desc: '캠퍼스 공지 형식 리스닝 + 문제 세트',   badge: 'bg-teal-100 text-teal-700' },
    { value: 'academic_talk',      label: 'Academic Talk',       desc: '교수/강연자 학술 강의 + 문제 세트',     badge: 'bg-lime-100 text-lime-700' },
  ],
  writing: [
    { value: 'sentence_reordering', label: 'Build a Sentence', desc: '단어 칩 배열 → 올바른 문장 완성', badge: 'bg-purple-100 text-purple-700' },
    { value: 'email_writing', label: 'Write an Email', desc: '상황 + 조건 3가지 → 이메일 쓰기', badge: 'bg-violet-100 text-violet-700' },
    { value: 'academic_discussion', label: 'Academic Discussion', desc: '교수 질문 + 학생 2명 의견 → 토론 참여', badge: 'bg-rose-100 text-rose-700' },
  ],
  speaking: [
    { value: 'listen_and_repeat', label: 'Listen and Repeat', desc: '원어민 문장 듣고 그대로 따라 말하기', badge: 'bg-orange-100 text-orange-700' },
    { value: 'take_an_interview', label: 'Take an Interview', desc: '면접관 질문 → 논리적 답변하기', badge: 'bg-amber-100 text-amber-700' },
  ],
}

const MULTI_QPP_SUBTYPES = [
  'daily_life_email', 'daily_life_text_chain', 'daily_life_notice', 'daily_life_guide',
  'daily_life_article', 'daily_life_campus_notice',
  'academic_passage', 'conversation', 'academic_talk', 'campus_announcement',
  'listen_and_repeat', 'take_an_interview',
]

// 스피킹 전용 라벨
const SPEAKING_SET_LABELS: Record<string, { setLabel: string; perSetLabel: string }> = {
  listen_and_repeat: { setLabel: '세트 개수', perSetLabel: '세트당 문장 개수' },
  take_an_interview: { setLabel: '인터뷰 셋 개수', perSetLabel: '셋당 질문 개수' },
}

// Per-subtype word/message count config for teacher-adjustable stepper
const WORD_COUNT_CONFIG: Record<string, { default: number; step: number; min: number; max: number; unit: string; label?: string }> = {
  complete_the_words:    { default: 100, step: 5,  min: 50,  max: 300, unit: '단어' },
  daily_life_email:          { default: 80, step: 5, min: 40, max: 200, unit: '단어' },
  daily_life_text_chain:     { default: 8,  step: 1, min: 4,  max: 30,  unit: '메시지' },
  daily_life_notice:         { default: 80, step: 5, min: 40, max: 200, unit: '단어' },
  daily_life_guide:          { default: 80, step: 5, min: 40, max: 200, unit: '단어' },
  daily_life_article:        { default: 80, step: 5, min: 40, max: 200, unit: '단어' },
  daily_life_campus_notice:  { default: 80, step: 5, min: 40, max: 200, unit: '단어' },
  academic_passage:      { default: 220, step: 5,  min: 100, max: 400, unit: '단어' },
  conversation:          { default: 80,  step: 5,  min: 40,  max: 200, unit: '단어' },
  academic_talk:         { default: 150, step: 5,  min: 80,  max: 400, unit: '단어' },
  campus_announcement:   { default: 150, step: 5,  min: 80,  max: 400, unit: '단어' },
  sentence_reordering:   { default: 10,  step: 1,  min: 5,   max: 15,  unit: '단어' },
  email_writing:         { default: 80,  step: 5,  min: 40,  max: 300, unit: '단어', label: '모범 이메일 답변 길이' },
}

// Academic Discussion 세부 단어 수 기본값
const ACAD_DISC_DEFAULT = { prof: 80, studentA: 70, studentB: 70, answer: 100 }

export default function GenerateQuestionsPage() {
  const router = useRouter()
  const [category, setCategory] = useState('reading')
  const [readingTopType, setReadingTopType] = useState<string | null>(null)
  const [subtype, setSubtype] = useState<string | null>(null)
  const [difficulty, setDifficulty] = useState(3.0)
  const [count, setCount] = useState(3)
  const [questionsPerPassage, setQuestionsPerPassage] = useState(3)
  const [topic, setTopic] = useState('')
  const [wordCount, setWordCount] = useState(0)
  const [acadDiscWords, setAcadDiscWords] = useState({ ...ACAD_DISC_DEFAULT })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')
  const [audioUrls, setAudioUrls] = useState<Record<number, string>>({})
  const [generatingAudioSet, setGeneratingAudioSet] = useState<Set<number>>(new Set())

  function handleCategoryChange(newCat: string) {
    setCategory(newCat)
    setReadingTopType(null)
    setSubtype(null)
    setWordCount(0)
    setAcadDiscWords({ ...ACAD_DISC_DEFAULT })
    setQuestions([])
    setSelected(new Set())
  }

  function handleReadingTopType(val: string) {
    if (val === 'daily_life') {
      // Daily Life 클릭: 상위 선택만, subtype은 하위에서 선택
      setReadingTopType(val)
      setSubtype(null)
      setWordCount(0)
    } else {
      // 단일 유형: 바로 subtype으로 설정
      setReadingTopType(val)
      setSubtype(val)
      setWordCount(WORD_COUNT_CONFIG[val]?.default ?? 0)
    }
  }

  function handleSubtypeToggle(val: string) {
    const next = subtype === val ? null : val
    setSubtype(next)
    setWordCount(next && WORD_COUNT_CONFIG[next] ? WORD_COUNT_CONFIG[next].default : 0)
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
        body: JSON.stringify({ category, subtype, difficulty, count, topic, questionsPerPassage: isMultiQpp ? questionsPerPassage : 1, wordCount: wordCount > 0 ? wordCount : undefined, acadDiscWords: subtype === 'academic_discussion' ? acadDiscWords : undefined }),
      })

      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setQuestions(data.questions)
      setSelected(new Set(data.questions.map((_: GeneratedQuestion, i: number) => i)))
      setAudioUrls({})
      setGeneratingAudioSet(new Set())
    } catch (err) {
      setError('문제 생성 실패: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateAudio(idx: number) {
    const q = questions[idx]
    if (!q?.audio_script) return
    setGeneratingAudioSet(prev => new Set([...prev, idx]))
    try {
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: q.audio_script, subtype: q.question_subtype }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.audioUrl) setAudioUrls(prev => ({ ...prev, [idx]: data.audioUrl }))
      }
    } finally {
      setGeneratingAudioSet(prev => { const next = new Set(prev); next.delete(idx); return next })
    }
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    const toSave = questions
      .map((q, i) => ({ ...q, audio_url: audioUrls[i] ?? null }))
      .filter((_, i) => selected.has(i))

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
  const isMultiQpp = subtype !== null && MULTI_QPP_SUBTYPES.includes(subtype)
  const speakingLabels = subtype ? SPEAKING_SET_LABELS[subtype] : null
  const setCountLabel = speakingLabels?.setLabel ?? '문제 Set 개수'
  const perSetLabel = speakingLabels?.perSetLabel ?? '지문당 문제 개수'

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

        {/* 세부 유형 카드 — Reading */}
        {category === 'reading' && (
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700">
              문제 유형 <span className="text-xs font-normal text-gray-400">(선택 — 미선택 시 학술 지문으로 생성)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {READING_TOP_TYPES.map(opt => {
                const isSelected = readingTopType === opt.value
                return (
                  <button key={opt.value} type="button"
                    onClick={() => handleReadingTopType(opt.value)}
                    className={`text-left p-3 rounded-xl border-2 transition ${
                      isSelected ? 'border-purple-500 bg-purple-50' : 'border-gray-100 hover:border-gray-200 bg-white'
                    }`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${opt.badge}`}>{opt.label}</span>
                      {isSelected && (
                        <span className="w-4 h-4 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <Check size={10} className="text-white" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{opt.desc}</p>
                  </button>
                )
              })}
            </div>

            {/* Daily Life 하위 형식 */}
            {readingTopType === 'daily_life' && (
              <div className="pl-1">
                <label className="block text-xs font-semibold text-gray-600 mb-2">Daily Life 형식 선택</label>
                <div className="grid grid-cols-2 gap-2">
                  {DAILY_LIFE_FORMATS.map(fmt => {
                    const isSelected = subtype === fmt.value
                    return (
                      <button key={fmt.value} type="button"
                        onClick={() => handleSubtypeToggle(fmt.value)}
                        className={`text-left p-3 rounded-xl border-2 transition ${
                          isSelected ? 'border-cyan-500 bg-cyan-50' : 'border-gray-100 hover:border-gray-200 bg-white'
                        }`}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${fmt.badge}`}>{fmt.label}</span>
                          {isSelected && (
                            <span className="w-4 h-4 bg-cyan-600 rounded-full flex items-center justify-center flex-shrink-0">
                              <Check size={10} className="text-white" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{fmt.desc}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 세부 유형 카드 — Listening / Writing / Speaking */}
        {category !== 'reading' && subtypeList.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              문제 유형 <span className="text-xs font-normal text-gray-400">(선택)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {subtypeList.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => handleSubtypeToggle(opt.value)}
                  className={`text-left p-3 rounded-xl border-2 transition ${
                    subtype === opt.value ? 'border-purple-500 bg-purple-50' : 'border-gray-100 hover:border-gray-200 bg-white'
                  }`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${opt.badge}`}>{opt.label}</span>
                    {subtype === opt.value && (
                      <span className="w-4 h-4 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <Check size={10} className="text-white" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Academic Discussion 세부 단어 수 */}
        {subtype === 'academic_discussion' && (
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700">생성 단어 수 설정</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: 'prof',    label: '교수 질문', min: 50,  max: 200, step: 10 },
                { key: 'studentA', label: '학생 A 의견', min: 30, max: 150, step: 5 },
                { key: 'studentB', label: '학생 B 의견', min: 30, max: 150, step: 5 },
                { key: 'answer',  label: '모범 답변', min: 50,  max: 300, step: 10 },
              ] as const).map(({ key, label, min, max, step }) => {
                const val = acadDiscWords[key]
                const def = ACAD_DISC_DEFAULT[key]
                return (
                  <div key={key} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs font-semibold text-gray-600 mb-2">{label}</p>
                    <div className="flex items-center gap-2">
                      <button type="button"
                        onClick={() => setAcadDiscWords(w => ({ ...w, [key]: Math.max(min, w[key] - step) }))}
                        disabled={val <= min}
                        className="w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-600 font-bold hover:bg-gray-100 disabled:opacity-40 transition flex items-center justify-center text-base">
                        −
                      </button>
                      <span className="text-sm font-bold text-gray-800 min-w-[50px] text-center">{val}단어</span>
                      <button type="button"
                        onClick={() => setAcadDiscWords(w => ({ ...w, [key]: Math.min(max, w[key] + step) }))}
                        disabled={val >= max}
                        className="w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-600 font-bold hover:bg-gray-100 disabled:opacity-40 transition flex items-center justify-center text-base">
                        +
                      </button>
                      {val !== def && (
                        <button type="button"
                          onClick={() => setAcadDiscWords(w => ({ ...w, [key]: def }))}
                          className="text-[10px] text-gray-400 hover:text-gray-600 underline">
                          초기화
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 단어 수 조절 (academic_discussion 제외, subtype에 config 있을 때만) */}
        {subtype && subtype !== 'academic_discussion' && WORD_COUNT_CONFIG[subtype] && (() => {
          const cfg = WORD_COUNT_CONFIG[subtype]
          const cur = wordCount > 0 ? wordCount : cfg.default
          return (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {cfg.label ?? '생성 길이'}
                <span className="ml-2 text-xs font-normal text-gray-400">기본값: {cfg.default}{cfg.unit}</span>
              </label>
              <div className="flex items-center gap-3">
                <button type="button"
                  onClick={() => setWordCount(Math.max(cfg.min, cur - cfg.step))}
                  disabled={cur <= cfg.min}
                  className="w-9 h-9 rounded-lg border border-gray-200 bg-white text-gray-600 font-bold text-lg hover:bg-gray-100 disabled:opacity-40 transition flex items-center justify-center">
                  −
                </button>
                <span className="text-sm font-bold text-gray-800 min-w-[60px] text-center">
                  {cur} {cfg.unit}
                </span>
                <button type="button"
                  onClick={() => setWordCount(Math.min(cfg.max, cur + cfg.step))}
                  disabled={cur >= cfg.max}
                  className="w-9 h-9 rounded-lg border border-gray-200 bg-white text-gray-600 font-bold text-lg hover:bg-gray-100 disabled:opacity-40 transition flex items-center justify-center">
                  +
                </button>
                {cur !== cfg.default && (
                  <button type="button"
                    onClick={() => setWordCount(cfg.default)}
                    className="text-xs text-gray-400 hover:text-gray-600 underline ml-1">
                    초기화
                  </button>
                )}
              </div>
            </div>
          )
        })()}

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
              {isMultiQpp ? setCountLabel : '문제 개수'}
            </label>
            <select value={count} onChange={e => setCount(Number(e.target.value))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500">
              {(isMultiQpp ? [1, 2, 3, 5] : [1, 2, 3, 5, 10]).map(n => <option key={n} value={n}>{n}개</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">주제/키워드 (선택)</label>
            <input value={topic} onChange={e => setTopic(e.target.value)}
              placeholder="예: 생태학, 천문학, 캠퍼스 생활..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
        </div>

        {/* 지문/셋당 문제 개수 (multi-QPP subtypes only) */}
        {isMultiQpp && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              {perSetLabel}
              <span className="ml-2 text-xs font-normal text-gray-400">총 {count * questionsPerPassage}개 문제 생성</span>
            </label>
            <div className="flex gap-2">
              {(subtype === 'listen_and_repeat' ? [1, 2, 3, 4, 5, 6, 7, 8] : [1, 2, 3, 4, 5, 6]).map(n => (
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
                        <div className="bg-gray-50 border-l-2 border-blue-400 p-3 rounded text-xs text-gray-600 mb-3 whitespace-pre-wrap">
                          {q.passage}
                        </div>
                      )}
                      {q.audio_script && !q.passage && (
                        <div className="mb-3">
                          <div className="bg-emerald-50 border-l-2 border-emerald-400 p-3 rounded text-xs text-gray-600 whitespace-pre-wrap">
                            {q.audio_script}
                          </div>
                          {q.question_subtype === 'listen_and_repeat' && (
                            <div className="mt-1.5" onClick={e => e.stopPropagation()}>
                              {audioUrls[i] ? (
                                <div className="flex items-center gap-2">
                                  <audio controls src={audioUrls[i]} className="h-8 flex-1 min-w-0" />
                                  <button
                                    onClick={() => handleGenerateAudio(i)}
                                    disabled={generatingAudioSet.has(i)}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition disabled:opacity-40"
                                    title="음성 재생성"
                                  >
                                    {generatingAudioSet.has(i) ? <Loader2 size={13} className="animate-spin" /> : <Volume2 size={13} />}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleGenerateAudio(i)}
                                  disabled={generatingAudioSet.has(i)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg text-xs font-semibold text-orange-700 transition disabled:opacity-50"
                                >
                                  {generatingAudioSet.has(i) ? <Loader2 size={12} className="animate-spin" /> : <Volume2 size={12} />}
                                  {generatingAudioSet.has(i) ? '생성 중...' : '음성 생성'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      <p className="text-sm font-semibold text-gray-800 mb-2 break-words">{q.content}</p>
                      {q.options?.map(opt => (
                        <p key={opt.num} className="text-xs text-gray-600 py-0.5">
                          <span className="font-semibold">{optionLabel(opt.num, usesAlphaOptions(q.category, q.question_subtype))}.</span> {opt.text}
                        </p>
                      ))}
                      {(q.question_subtype === 'email_writing' || q.question_subtype === 'academic_discussion') ? (
                        <div className="mt-2 space-y-1.5">
                          <p className="text-xs font-semibold text-green-700">모범 답안</p>
                          <p className="text-xs text-gray-800 bg-green-50 px-3 py-2 rounded whitespace-pre-wrap leading-5">{q.answer}</p>
                          {q.explanation && (
                            <p className="text-xs text-gray-400 whitespace-pre-wrap leading-4">
                              {q.question_subtype === 'academic_discussion'
                                ? q.explanation.split('\n\n===번역===')[0].trim()
                                : q.explanation}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-green-700 font-semibold bg-green-50 px-2 py-0.5 rounded break-all line-clamp-3">
                            정답: {usesAlphaOptions(q.category, q.question_subtype) && /^\d+$/.test(q.answer) ? optionLabel(Number(q.answer), true) : q.answer}
                          </span>
                          {q.explanation && <span className="text-xs text-gray-400 line-clamp-3 break-words">{q.explanation}</span>}
                        </div>
                      )}
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
