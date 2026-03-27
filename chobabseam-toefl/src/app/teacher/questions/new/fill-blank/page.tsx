'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ChevronRight, ChevronLeft, Eye, Save, X, Info,
  BookOpen, Clock, BarChart2, CheckCircle, Pencil,
} from 'lucide-react'

// ────────── 타입 ──────────
interface Token {
  id: string
  type: 'word' | 'nonword'
  text: string
  isBlank: boolean
  showLetters: number
}

interface PopupState {
  tokenId: string
  x: number
  y: number
}

// ────────── 상수 ──────────
const DIFFICULTY_OPTIONS = [
  { value: 'B1',  label: 'IELTS Band 4.0–5.0  (B1)' },
  { value: 'B1+', label: 'IELTS Band 5.0–5.5  (B1+)' },
  { value: 'B2',  label: 'IELTS Band 5.5–6.5  (B2)' },
  { value: 'B2+', label: 'IELTS Band 6.5–7.0  (B2+)' },
  { value: 'C1',  label: 'IELTS Band 7.0–7.5  (C1)' },
  { value: 'C2',  label: 'IELTS Band 8.0+      (C2)' },
]
const DIFF_TO_NUM: Record<string, number> = { B1: 1, 'B1+': 2, B2: 3, 'B2+': 4, C1: 5, C2: 5 }

// ────────── 유틸 ──────────
function tokenize(text: string): Token[] {
  const parts = text.match(/[a-zA-Z''-]+|[^a-zA-Z''-]+/g) ?? []
  return parts.map((part, i) => ({
    id: `t${i}`,
    type: /[a-zA-Z]/.test(part) ? 'word' : 'nonword',
    text: part,
    isBlank: false,
    showLetters: 0,
  }))
}

function letters(token: Token) {
  return token.text.replace(/[^a-zA-Z]/g, '')
}

function blankDisplay(token: Token) {
  const w = letters(token)
  return w.slice(0, token.showLetters) + '_'.repeat(Math.max(0, w.length - token.showLetters))
}

function groupSentences(tokens: Token[]): Token[][] {
  const groups: Token[][] = []
  let cur: Token[] = []
  tokens.forEach(t => {
    cur.push(t)
    if (t.type === 'nonword' && t.text.includes('\n')) {
      groups.push(cur)
      cur = []
    }
  })
  if (cur.length) groups.push(cur)
  return groups.filter(g => g.some(t => t.type === 'word'))
}

// ────────── Step Indicator ──────────
const STEP_LABELS = ['기본 정보', '원문 입력', '빈칸 지정', '채점 설정', '미리보기']

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center mb-6 overflow-x-auto">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        return (
          <div key={i} className="flex items-center flex-shrink-0">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              active ? 'bg-blue-600 text-white shadow-sm' :
              done   ? 'bg-blue-100 text-blue-700' :
                       'bg-gray-100 text-gray-400'
            }`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-black ${
                active ? 'bg-white/20' : done ? 'bg-blue-200' : ''
              }`}>
                {done ? '✓' : n}
              </span>
              {active && <span>{label}</span>}
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`w-5 h-0.5 mx-1 ${done ? 'bg-blue-300' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ────────── 빈칸 미리보기 (학생 뷰) ──────────
function BlankInput({ token }: { token: Token }) {
  const w = letters(token)
  const shown = w.slice(0, token.showLetters)
  const hidden = w.length - token.showLetters
  return (
    <span className="inline-flex items-baseline">
      {shown && <span className="font-semibold">{shown}</span>}
      <input
        readOnly
        placeholder={'_'.repeat(hidden)}
        style={{ width: `${Math.max(hidden * 11 + 12, 24)}px` }}
        className="border-b-2 border-blue-400 bg-transparent text-center font-mono text-sm outline-none
                   text-blue-700 placeholder-blue-300 mx-0.5 pb-0.5"
      />
    </span>
  )
}

// ────────── 메인 ──────────
export default function FillBlankPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(1)

  // 1단계
  const [title, setTitle]         = useState('')
  const [difficulty, setDifficulty] = useState('B2')
  const [timeLimit, setTimeLimit]  = useState(10)
  const [format, setFormat]        = useState<'paragraph' | 'sentences'>('paragraph')

  // 2단계
  const [fullText, setFullText] = useState('')

  // 3단계
  const [tokens, setTokens]       = useState<Token[]>([])
  const [popup, setPopup]         = useState<PopupState | null>(null)
  const [showN, setShowN]         = useState(0)
  const popupRef = useRef<HTMLDivElement>(null)

  // 4단계
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [ptsPerBlank, setPtsPerBlank]     = useState(1)
  const [scoringMode, setScoringMode]     = useState<'per_blank' | 'per_sentence'>('per_blank')

  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const blanks = tokens.filter(t => t.isBlank)
  const sentencesWithBlanks = format === 'sentences'
    ? groupSentences(tokens).filter(g => g.some(t => t.isBlank)).length
    : 0
  const totalPoints = scoringMode === 'per_sentence' && format === 'sentences'
    ? sentencesWithBlanks * ptsPerBlank
    : blanks.length * ptsPerBlank

  // popup 외부 클릭 닫기
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPopup(null)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // 단어 클릭
  function handleWordClick(tokenId: string, e: React.MouseEvent) {
    e.stopPropagation()
    const token = tokens.find(t => t.id === tokenId)
    if (!token || token.type !== 'word') return
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setPopup({ tokenId, x: rect.left, y: rect.bottom + 6 })
    const w = letters(token)
    setShowN(token.isBlank ? token.showLetters : Math.max(1, Math.floor(w.length / 2)))
  }

  function applyBlank() {
    if (!popup) return
    setTokens(prev => prev.map(t =>
      t.id === popup.tokenId ? { ...t, isBlank: true, showLetters: showN } : t
    ))
    setPopup(null)
  }

  function removeBlank(tokenId: string) {
    setTokens(prev => prev.map(t =>
      t.id === tokenId ? { ...t, isBlank: false, showLetters: 0 } : t
    ))
    setPopup(null)
  }

  function goToStep3() {
    if (!fullText.trim()) return
    setTokens(tokenize(fullText))
    setStep(3)
  }

  async function handleSave() {
    setLoading(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const answers = blanks.map(t => t.text)

    const { error: dbErr } = await supabase.from('questions').insert({
      teacher_id: user.id,
      type: 'essay',
      category: 'reading',
      subcategory: null,
      difficulty: DIFF_TO_NUM[difficulty] ?? 3,
      content: title || 'Fill in the missing letters.',
      passage: JSON.stringify(tokens),
      options: null,
      answer: JSON.stringify({ answers, caseSensitive, ptsPerBlank, scoringMode }),
      explanation: JSON.stringify({ title, difficulty, timeLimit, format }),
      source: 'teacher',
      audio_url: null,
      audio_script: null,
      audio_play_limit: null,
      speaking_prompt: null,
      preparation_time: null,
      response_time: null,
      word_limit: timeLimit,
      question_subtype: format === 'paragraph' ? 'complete_the_words' : 'sentence_completion',
      task_number: null,
    })

    if (dbErr) { setError('저장 실패: ' + dbErr.message); setLoading(false); return }
    router.push('/teacher/questions')
    router.refresh()
  }

  const selectedToken = popup ? tokens.find(t => t.id === popup.tokenId) : null
  const selectedLetters = selectedToken ? letters(selectedToken) : ''
  const previewBlank = selectedLetters.slice(0, showN) + '_'.repeat(Math.max(0, selectedLetters.length - showN))

  // ──── 토큰 렌더러 (편집용) ────
  function renderEditTokens() {
    if (format === 'paragraph') {
      return (
        <div className="text-base leading-9 select-none">
          {tokens.map(t =>
            t.type === 'nonword'
              ? <span key={t.id} className="whitespace-pre-wrap">{t.text}</span>
              : (
                <span key={t.id}
                  onClick={e => handleWordClick(t.id, e)}
                  className={`cursor-pointer rounded px-0.5 transition-all ${
                    t.isBlank
                      ? 'bg-blue-100 text-blue-800 font-mono font-bold border-b-2 border-blue-400'
                      : 'hover:bg-yellow-100 hover:text-yellow-800 hover:underline decoration-dotted'
                  }`}>
                  {t.isBlank ? blankDisplay(t) : t.text}
                </span>
              )
          )}
        </div>
      )
    }

    // sentences
    return (
      <div className="space-y-2.5">
        {groupSentences(tokens).map((sent, si) => (
          <div key={si} className="flex items-baseline gap-3">
            <span className="text-sm font-bold text-gray-400 w-6 flex-shrink-0 text-right">{si + 1}.</span>
            <div className="text-base leading-8 select-none">
              {sent.filter(t => !t.text.includes('\n')).map(t =>
                t.type === 'nonword'
                  ? <span key={t.id} className="whitespace-pre">{t.text.replace('\n', '')}</span>
                  : (
                    <span key={t.id}
                      onClick={e => handleWordClick(t.id, e)}
                      className={`cursor-pointer rounded px-0.5 transition-all ${
                        t.isBlank
                          ? 'bg-blue-100 text-blue-800 font-mono font-bold border-b-2 border-blue-400'
                          : 'hover:bg-yellow-100 hover:text-yellow-800 hover:underline decoration-dotted'
                      }`}>
                      {t.isBlank ? blankDisplay(t) : t.text}
                    </span>
                  )
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ──── 토큰 렌더러 (학생 미리보기) ────
  function renderPreviewTokens() {
    if (format === 'paragraph') {
      return (
        <div className="text-base leading-9 text-gray-900">
          {tokens.map(t =>
            t.type === 'nonword'
              ? <span key={t.id} className="whitespace-pre-wrap">{t.text}</span>
              : t.isBlank
                ? <BlankInput key={t.id} token={t} />
                : <span key={t.id}>{t.text}</span>
          )}
        </div>
      )
    }
    return (
      <div className="space-y-3">
        {groupSentences(tokens).map((sent, si) => (
          <div key={si} className="flex items-baseline gap-3">
            <span className="text-sm font-bold text-gray-500 w-6 flex-shrink-0 text-right">{si + 1}.</span>
            <div className="text-base leading-8 text-gray-900">
              {sent.filter(t => !t.text.includes('\n')).map(t =>
                t.type === 'nonword'
                  ? <span key={t.id}>{t.text.replace('\n', '')}</span>
                  : t.isBlank
                    ? <BlankInput key={t.id} token={t} />
                    : <span key={t.id}>{t.text}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="p-7 max-w-3xl">
      {/* 헤더 */}
      <div className="mb-5">
        <button onClick={() => router.back()} className="text-xs text-gray-400 hover:text-gray-600 mb-2 flex items-center gap-1">
          <ChevronLeft size={13} /> 문제 출제로 돌아가기
        </button>
        <h1 className="text-2xl font-extrabold text-gray-900">빈칸 채우기 문제 출제</h1>
        <p className="text-gray-500 text-sm mt-1">클릭으로 빈칸을 지정하는 인터랙티브 5단계 출제 도구</p>
      </div>

      <StepIndicator current={step} />

      {/* ═══ STEP 1: 기본 정보 ═══ */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <BookOpen size={18} className="text-blue-500" /> 기본 정보 설정
          </h2>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              지문 제목 <span className="text-red-500">*</span>
            </label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="예: 음악의 보편성 / The Universality of Music"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                <BarChart2 size={13} /> 목표 난이도
              </label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {DIFFICULTY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                <Clock size={13} /> 제한 시간 (분)
              </label>
              <input type="number" value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))}
                min={1} max={60}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">텍스트 형식</label>
            <div className="flex gap-3">
              {([
                { v: 'paragraph', label: '단락 (Paragraph)', desc: '연속된 학술 지문' },
                { v: 'sentences', label: '문장 목록 (Set)', desc: '번호 붙은 문장들 (A Set 1 형식)' },
              ] as const).map(o => (
                <button key={o.v} type="button" onClick={() => setFormat(o.v)}
                  className={`flex-1 p-3.5 rounded-xl border-2 text-left transition ${
                    format === o.v ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}>
                  <div className="font-bold text-sm text-gray-900">{o.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{o.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => setStep(2)} disabled={!title.trim()}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white rounded-xl font-bold transition flex items-center justify-center gap-2">
            다음: 원문 입력 <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* ═══ STEP 2: 원문 입력 ═══ */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <h2 className="font-bold text-gray-900">완전한 원문 입력</h2>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
            <Info size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              빈칸이나 밑줄 <strong>없이</strong> 완전한 영어 원문을 붙여넣으세요.
              {format === 'sentences' && ' 문장은 줄바꿈(Enter)으로 구분하세요.'}
            </p>
          </div>

          <textarea
            value={fullText} onChange={e => setFullText(e.target.value)}
            placeholder={format === 'paragraph'
              ? 'Music is a universal element of human culture. As melodies and rhythms spread across borders, they inspire creativity and foster connections between communities...'
              : 'Advances in medical technology have transformed patient care worldwide.\nMany students rely on digital resources for exam preparation.\nEconomic reforms often lead to long-term growth.\nPoor planning can result in unexpected delays.'}
            rows={format === 'paragraph' ? 10 : 13}
            className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed" />

          <div className="flex gap-3">
            <button onClick={() => setStep(1)}
              className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition flex items-center gap-1.5">
              <ChevronLeft size={16} /> 이전
            </button>
            <button onClick={goToStep3} disabled={!fullText.trim()}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white rounded-xl font-bold transition flex items-center justify-center gap-2">
              다음: 빈칸 만들기 <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: 인터랙티브 빈칸 지정 ═══ */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900">빈칸 지정</h2>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-bold ${blanks.length > 0 ? 'text-blue-700' : 'text-gray-400'}`}>
                  {blanks.length}개 빈칸
                </span>
                {blanks.length > 0 && (
                  <button onClick={() => setTokens(p => p.map(t => ({ ...t, isBlank: false, showLetters: 0 })))}
                    className="text-xs text-red-500 hover:text-red-700 hover:underline">
                    모두 초기화
                  </button>
                )}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-2">
              <Info size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                단어를 <strong>클릭</strong>하면 팝업이 뜹니다. 앞 글자 수를 설정하여 빈칸을 만드세요.
                빈칸 단어를 다시 클릭하면 수정/제거할 수 있습니다.
              </p>
            </div>

            {/* 텍스트 편집 영역 */}
            <div className="p-2 bg-gray-50 rounded-xl min-h-32">
              {renderEditTokens()}
            </div>

            {/* 빈칸 요약 */}
            {blanks.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-xl">
                {format === 'sentences' ? (
                  // 문장별 그룹 표시
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-blue-700">
                      지정된 빈칸 {blanks.length}개 ({sentencesWithBlanks}문장에 분포)
                    </p>
                    {groupSentences(tokens)
                      .map((sent, si) => {
                        const sentBlanks = sent.filter(t => t.isBlank)
                        if (sentBlanks.length === 0) return null
                        return (
                          <div key={si} className="flex items-center gap-2 bg-white border border-blue-200 rounded-xl px-3 py-2">
                            <span className="text-xs font-bold text-gray-400 w-5 flex-shrink-0">{si + 1}.</span>
                            <div className="flex items-center gap-1.5 flex-wrap flex-1">
                              {sentBlanks.map(t => (
                                <div key={t.id} className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-lg px-1.5 py-0.5 text-xs">
                                  <span className="font-mono font-bold text-blue-700">{blankDisplay(t)}</span>
                                  <span className="text-gray-400">→ {t.text}</span>
                                  <button onClick={() => removeBlank(t.id)} className="ml-0.5 text-gray-300 hover:text-red-400">
                                    <X size={10} />
                                  </button>
                                </div>
                              ))}
                            </div>
                            {sentBlanks.length > 1 && (
                              <span className="text-xs bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded flex-shrink-0">
                                묶음 {sentBlanks.length}개
                              </span>
                            )}
                          </div>
                        )
                      })}
                  </div>
                ) : (
                  // 단락: 기존 방식
                  <>
                    <p className="text-xs font-semibold text-blue-700 mb-2">지정된 빈칸 {blanks.length}개</p>
                    <div className="flex flex-wrap gap-2">
                      {blanks.map((t, i) => (
                        <div key={t.id} className="flex items-center gap-1 bg-white border border-blue-200 rounded-lg px-2 py-1 text-xs">
                          <span className="text-gray-400">{i + 1}.</span>
                          <span className="font-mono font-bold text-blue-700">{blankDisplay(t)}</span>
                          <span className="text-gray-400">→</span>
                          <span className="font-semibold text-gray-700">{t.text}</span>
                          <button onClick={() => removeBlank(t.id)} className="ml-1 text-gray-300 hover:text-red-400 transition">
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)}
              className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition flex items-center gap-1.5">
              <ChevronLeft size={16} /> 원문 수정
            </button>
            <button onClick={() => setStep(4)} disabled={blanks.length === 0}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white rounded-xl font-bold transition flex items-center justify-center gap-2">
              다음: 채점 설정 ({blanks.length}개 빈칸) <ChevronRight size={16} />
            </button>
          </div>

          {/* ── 단어 팝업 ── */}
          {popup && selectedToken && (
            <div ref={popupRef}
              className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 w-72"
              style={{ top: popup.y, left: Math.min(popup.x, (typeof window !== 'undefined' ? window.innerWidth : 800) - 295) }}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-gray-900 flex items-center gap-1.5">
                  <Pencil size={13} className="text-blue-500" /> 빈칸 설정
                </span>
                <button onClick={() => setPopup(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500 w-16 flex-shrink-0">원래 단어</span>
                  <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded-lg">
                    {selectedToken.text}
                  </span>
                  <span className="text-xs text-gray-400">({selectedLetters.length}자)</span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-gray-500">앞 글자 수 (보여줄 글자)</span>
                    <span className="text-xs font-bold text-blue-700">{showN}자</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="range"
                      min={0} max={Math.max(0, selectedLetters.length - 1)}
                      value={showN}
                      onChange={e => setShowN(Number(e.target.value))}
                      className="flex-1 accent-blue-600 h-1.5" />
                    <input type="number"
                      min={0} max={Math.max(0, selectedLetters.length - 1)}
                      value={showN}
                      onChange={e => setShowN(Math.max(0, Math.min(selectedLetters.length - 1, Number(e.target.value))))}
                      className="w-12 px-1 py-1 border border-gray-200 rounded-lg text-sm text-center font-mono focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500 w-16 flex-shrink-0">미리보기</span>
                  <span className="font-mono font-bold text-blue-700 bg-blue-50 px-4 py-2 rounded-xl text-xl tracking-[0.2em] border border-blue-100">
                    {previewBlank || '_'.repeat(selectedLetters.length)}
                  </span>
                </div>

                <div className="flex gap-2 pt-1">
                  {selectedToken.isBlank && (
                    <button onClick={() => removeBlank(selectedToken.id)}
                      className="flex-1 py-2 text-red-600 border border-red-200 rounded-xl text-sm font-semibold hover:bg-red-50 transition">
                      빈칸 제거
                    </button>
                  )}
                  <button onClick={applyBlank}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition">
                    {selectedToken.isBlank ? '수정 완료' : '빈칸 지정'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ STEP 4: 채점 설정 ═══ */}
      {step === 4 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <h2 className="font-bold text-gray-900">채점 및 배점 설정</h2>

          {/* 채점 방식 (문장 Set 형식일 때만 표시) */}
          {format === 'sentences' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">채점 방식</label>
              <div className="flex gap-3">
                {([
                  {
                    v: 'per_blank',
                    label: '빈칸별 채점',
                    desc: '각 빈칸이 독립적으로 점수 부여\n예) "rel___" 1점 + "o_" 1점 = 2점',
                  },
                  {
                    v: 'per_sentence',
                    label: '문장별 채점 (묶음)',
                    desc: '한 문장의 빈칸을 모두 맞혀야 1점\n예) "rely on" → 둘 다 정답일 때만 1점',
                  },
                ] as const).map(o => (
                  <button key={o.v} type="button" onClick={() => setScoringMode(o.v)}
                    className={`flex-1 p-3.5 rounded-xl border-2 text-left transition ${
                      scoringMode === o.v ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}>
                    <div className="font-bold text-sm text-gray-900 mb-1">{o.label}</div>
                    <div className="text-xs text-gray-500 whitespace-pre-line">{o.desc}</div>
                  </button>
                ))}
              </div>
              {scoringMode === 'per_sentence' && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex items-start gap-2">
                  <Info size={13} className="flex-shrink-0 mt-0.5" />
                  <span>
                    빈칸이 있는 문장 <strong>{sentencesWithBlanks}개</strong>가 각 1문제로 채점됩니다.
                    한 문장 안의 빈칸을 하나라도 틀리면 해당 문장은 0점입니다.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 대소문자 */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div>
              <p className="font-semibold text-gray-900 text-sm">대소문자 구분 (Case Sensitive)</p>
              <p className="text-xs text-gray-500 mt-0.5">끄면 "Music"과 "music" 둘 다 정답으로 처리</p>
            </div>
            <button onClick={() => setCaseSensitive(p => !p)}
              className={`relative w-12 h-6 rounded-full transition-colors focus:outline-none ${caseSensitive ? 'bg-blue-600' : 'bg-gray-300'}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${caseSensitive ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* 배점 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">빈칸 1개당 배점</label>
            <div className="flex gap-2">
              {[0.5, 1, 2, 3].map(p => (
                <button key={p} type="button" onClick={() => setPtsPerBlank(p)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition ${
                    ptsPerBlank === p ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
                  }`}>
                  {p}점
                </button>
              ))}
            </div>
          </div>

          {/* 채점 방식 안내 */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
            <p className="text-xs font-bold text-gray-700">채점 방식</p>
            <div className="space-y-1.5 text-xs text-gray-600">
              <div className="flex items-start gap-2">
                <CheckCircle size={12} className="text-green-500 mt-0.5 flex-shrink-0" />
                <span>빈칸별 독립 채점 — 각 빈칸이 {ptsPerBlank}점씩 독립적으로 채점됩니다</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle size={12} className="text-green-500 mt-0.5 flex-shrink-0" />
                <span>정확히 일치하는 경우만 정답 처리 (앞 글자 포함 전체 단어)</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle size={12} className="text-green-500 mt-0.5 flex-shrink-0" />
                <span>대소문자: {caseSensitive ? '구분함 ("Music" ≠ "music")' : '구분 안 함 ("Music" = "music" ✓)'}</span>
              </div>
            </div>
          </div>

          {/* 요약 */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="font-bold text-blue-900">
              {scoringMode === 'per_sentence' && format === 'sentences'
                ? <>{sentencesWithBlanks}문장 × {ptsPerBlank}점 = <span className="text-2xl">{totalPoints}점</span> 만점</>
                : <>{blanks.length}개 빈칸 × {ptsPerBlank}점 = <span className="text-2xl">{totalPoints}점</span> 만점</>
              }
            </p>
            <p className="text-xs text-blue-600 mt-1">
              {scoringMode === 'per_sentence' && format === 'sentences'
                ? `총 ${blanks.length}개 빈칸 → 문장별 묶음 채점`
                : '빈칸별 독립 채점'}
              {' '} | 제한 시간 {timeLimit}분
            </p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(3)}
              className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition flex items-center gap-1.5">
              <ChevronLeft size={16} /> 이전
            </button>
            <button onClick={() => setStep(5)}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-2">
              <Eye size={16} /> 학생 미리보기
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 5: 미리보기 & 저장 ═══ */}
      {step === 5 && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <Eye size={16} className="text-blue-500" /> 학생 화면 미리보기
              </h2>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Clock size={11} /> {timeLimit}분</span>
                <span>{blanks.length}개 빈칸</span>
                <span className="font-bold text-blue-700">{totalPoints}점 만점</span>
              </div>
            </div>

            {/* 학생 뷰 목업 */}
            <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-5">
              {/* TOEFL 상단 바 모킹 */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                <div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Reading</span>
                  <span className="text-xs text-gray-400 ml-2">| {title}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock size={11} />
                  <span>{timeLimit}:00</span>
                </div>
              </div>

              <p className="text-sm font-bold text-gray-700 mb-4">
                Fill in the missing letters in the paragraph.
              </p>
              {renderPreviewTokens()}
            </div>

            <p className="text-xs text-gray-400 mt-3 text-center">
              실제 학생 화면에서는 빈칸에 직접 입력할 수 있습니다
            </p>
          </div>

          {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200">{error}</div>}

          <div className="flex gap-3">
            <button onClick={() => setStep(4)}
              className="px-5 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition flex items-center gap-1.5">
              <ChevronLeft size={16} /> 이전
            </button>
            <button onClick={() => setStep(3)}
              className="px-5 py-3 border border-blue-200 text-blue-700 rounded-xl text-sm font-semibold hover:bg-blue-50 transition flex items-center gap-1.5">
              <Pencil size={14} /> 빈칸 수정
            </button>
            <button onClick={handleSave} disabled={loading}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-bold transition flex items-center justify-center gap-2">
              <Save size={16} />
              {loading ? '저장 중...' : scoringMode === 'per_sentence' && format === 'sentences'
                ? `발행하기 — ${sentencesWithBlanks}문장 / ${totalPoints}점 만점`
                : `발행하기 — ${blanks.length}개 빈칸 / ${totalPoints}점 만점`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
