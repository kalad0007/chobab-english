'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS, QUESTION_SUBTYPE_LABELS, SPEAKING_TASK_TIMES } from '@/lib/utils'
import { Volume2, Loader2, Plus, Trash2, ChevronDown, ChevronUp, Info, Wand2 } from 'lucide-react'
import UnderlineTextarea from '@/components/ui/UnderlineTextarea'
import Link from 'next/link'

// ────────── 유형 판별 헬퍼 ──────────
const isProseSummary = (sub: string) => sub === 'prose_summary'
const isFillTable    = (sub: string) => sub === 'fill_table'
const isCompleteWords = (sub: string) => sub === 'complete_the_words'
const isEssaySubtype = (sub: string) => isCompleteWords(sub)

interface MCQuestion {
  content: string
  questionSubtype: string
  // 4지선다 (standard)
  options: { num: number; text: string }[]
  answer: string
  explanation: string
  // prose_summary: 6지선다
  summaryOptions: { num: number; text: string }[]
  summaryCorrect: number[]   // 정답 번호 3개
  // fill_table
  tableCategories: [string, string, string]
  tableItems: { text: string; category: string }[]  // category='' → 오답(distractor)
}

const emptyMCQuestion = (): MCQuestion => ({
  content: '',
  questionSubtype: '',
  options: [
    { num: 1, text: '' }, { num: 2, text: '' },
    { num: 3, text: '' }, { num: 4, text: '' },
  ],
  answer: '',
  explanation: '',
  summaryOptions: Array.from({ length: 6 }, (_, i) => ({ num: i + 1, text: '' })),
  summaryCorrect: [],
  tableCategories: ['', '', ''],
  tableItems: Array.from({ length: 7 }, () => ({ text: '', category: '' })),
})

// ────────── 세부유형 뱃지 색상 ──────────
const SUBTYPE_BADGE: Record<string, string> = {
  prose_summary:     'bg-violet-100 text-violet-700',
  fill_table:        'bg-amber-100 text-amber-700',
  complete_the_words:'bg-teal-100 text-teal-700',
  read_in_daily_life:'bg-cyan-100 text-cyan-700',
  insert_text:       'bg-indigo-100 text-indigo-700',
}

// ────────── 개별 문제 에디터 ──────────
function QuestionEditor({
  q, qIdx, category, color,
  onUpdate, onUpdateOption, onUpdateSummaryOption,
  onToggleSummaryCorrect, onUpdateTableCategory, onUpdateTableItem,
}: {
  q: MCQuestion
  qIdx: number
  category: string
  color: string
  onUpdate: (patch: Partial<MCQuestion>) => void
  onUpdateOption: (optIdx: number, text: string) => void
  onUpdateSummaryOption: (optIdx: number, text: string) => void
  onToggleSummaryCorrect: (num: number) => void
  onUpdateTableCategory: (idx: number, val: string) => void
  onUpdateTableItem: (idx: number, patch: Partial<{ text: string; category: string }>) => void
}) {
  const ring = `focus:ring-${color}-500`
  const border = `border-${color}-200`

  // ── Prose Summary (6지선다, 3개 선택) ──
  if (isProseSummary(q.questionSubtype)) {
    return (
      <div className="space-y-4">
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex items-start gap-2">
          <Info size={14} className="text-violet-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-violet-700">
            6개 보기 중 <strong>3개의 핵심 내용</strong>을 정답으로 선택하세요. 정답은 최대 2점짜리입니다.
          </p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">도입문 (지문 전체 요약 시작 문장)</label>
          <textarea
            value={q.content}
            onChange={e => onUpdate({ content: e.target.value })}
            placeholder="An introductory sentence for a brief summary of the passage is provided below. Complete the summary by selecting the THREE answer choices..."
            rows={2}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-gray-600">보기 6개 입력</label>
            <span className="text-xs text-violet-700 font-bold">정답 {q.summaryCorrect.length}/3개 선택됨</span>
          </div>
          {q.summaryOptions.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onToggleSummaryCorrect(opt.num)}
                className={`w-7 h-7 rounded-full text-xs font-bold border-2 flex-shrink-0 transition ${
                  q.summaryCorrect.includes(opt.num)
                    ? 'bg-violet-600 border-violet-600 text-white'
                    : 'border-gray-300 text-gray-400 hover:border-violet-400'
                }`}
              >
                {opt.num}
              </button>
              <input
                value={opt.text}
                onChange={e => onUpdateSummaryOption(i, e.target.value)}
                placeholder={`보기 ${opt.num}${q.summaryCorrect.includes(opt.num) ? ' (정답)' : ''}`}
                className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 ${
                  q.summaryCorrect.includes(opt.num) ? 'border-violet-300 bg-violet-50' : 'border-gray-200'
                }`}
              />
            </div>
          ))}
          <p className="text-xs text-gray-400">동그라미 버튼을 눌러 정답 3개를 선택하세요</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">해설</label>
          <textarea value={q.explanation} onChange={e => onUpdate({ explanation: e.target.value })}
            placeholder="정답 해설..." rows={2}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
        </div>
      </div>
    )
  }

  // ── Fill in a Table (카테고리 분류) ──
  if (isFillTable(q.questionSubtype)) {
    const usedCategories = q.tableCategories.filter(c => c.trim())
    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
          <Info size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            7-9개 보기를 카테고리에 배정하세요. 일부는 오답(사용안함)으로 설정합니다. 5개 정답=3점, 7개 정답=4점.
          </p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">지시문</label>
          <textarea value={q.content} onChange={e => onUpdate({ content: e.target.value })}
            placeholder="Complete the table below to summarize information about..." rows={2}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">카테고리 이름 (최대 3개)</label>
          <div className="flex gap-2">
            {q.tableCategories.map((cat, i) => (
              <input key={i} value={cat} onChange={e => onUpdateTableCategory(i, e.target.value)}
                placeholder={`카테고리 ${i + 1}`}
                className={`flex-1 px-3 py-2 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${cat ? 'bg-amber-50' : ''}`} />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-semibold text-gray-600">항목 (7-9개, 일부는 오답으로)</label>
          {q.tableItems.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 text-center text-xs text-gray-400 flex-shrink-0">{i + 1}</span>
              <input value={item.text} onChange={e => onUpdateTableItem(i, { text: e.target.value })}
                placeholder={`항목 ${i + 1}`}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none" />
              <select value={item.category} onChange={e => onUpdateTableItem(i, { category: e.target.value })}
                className={`px-2 py-2 border rounded-lg text-xs font-semibold focus:outline-none ${
                  item.category ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-gray-200 text-gray-400'
                }`}>
                <option value="">오답(미사용)</option>
                {usedCategories.map((cat, ci) => (
                  <option key={ci} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">해설</label>
          <textarea value={q.explanation} onChange={e => onUpdate({ explanation: e.target.value })}
            placeholder="정답 해설..." rows={2}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" />
        </div>
      </div>
    )
  }

  // ── Complete the Words (빈칸 채우기) ──
  if (isCompleteWords(q.questionSubtype)) {
    return (
      <div className="space-y-4">
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 flex items-start gap-2">
          <Info size={14} className="text-teal-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-teal-700">
            지문에 빈칸(__)을 표시하세요. 예: <code className="bg-white px-1 rounded">te__</code> (tend),
            <code className="bg-white px-1 rounded ml-1">bel____</code> (believe).
            70-100 단어의 학술 단락, 두번째 문장부터 두번째 단어마다 뒷부분을 제거합니다.
          </p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            빈칸이 포함된 단락 <span className="text-red-500">*</span>
            <span className="text-gray-400 font-normal ml-1">(공유 지문과 별개로 이 문제 전용 단락)</span>
          </label>
          <textarea value={q.content} onChange={e => onUpdate({ content: e.target.value })}
            placeholder={`Footage captured by submarines has shown us that strange creatures thrive in the deepest parts of the ocean. People te__ to bel____ that su__ extreme environ____ are ju__ barren zon__. In rea____, research h__ clearly sh___ that li__ is abundant there.`}
            rows={6}
            className="w-full px-3 py-2.5 border border-teal-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none font-mono bg-white" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            정답 단어 (빈칸 순서대로, 쉼표로 구분) <span className="text-red-500">*</span>
          </label>
          <input value={q.answer} onChange={e => onUpdate({ answer: e.target.value })}
            placeholder="tend, believe, such, environments, just, zones, reality, has, shows, life"
            className="w-full px-3 py-2.5 border border-teal-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white" />
          <p className="text-xs text-gray-400 mt-1">빈칸 __ 이 나오는 순서대로 완성된 단어를 입력</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">해설</label>
          <textarea value={q.explanation} onChange={e => onUpdate({ explanation: e.target.value })}
            placeholder="각 빈칸 단어 설명..." rows={2}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
        </div>
      </div>
    )
  }

  // ── 기본 4지선다 (Standard MC) ──
  return (
    <div className="space-y-4">
      {/* 세부유형 선택 */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">문제 유형</label>
        <select value={q.questionSubtype}
          onChange={e => onUpdate({ questionSubtype: e.target.value })}
          className={`w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 ${ring}`}>
          <option value="">선택하세요</option>
          {QUESTION_SUBTYPE_LABELS[category] &&
            Object.entries(QUESTION_SUBTYPE_LABELS[category]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))
          }
        </select>
      </div>

      {/* 문제 본문 */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">문제</label>
        <textarea value={q.content} onChange={e => onUpdate({ content: e.target.value })}
          placeholder={
            category === 'reading'
              ? 'According to paragraph 2, which of the following is true about...?'
              : 'What is the main topic of the lecture?'
          }
          rows={2}
          className={`w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 ${ring} resize-none`} />
      </div>

      {/* Insert Text 안내 */}
      {q.questionSubtype === 'insert_text' && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-700">
          <strong>Insert Text:</strong> 지문에 삽입 위치를 ■ 기호로 표시하세요 (4개 위치).
          보기 A/B/C/D는 지문의 ■ 위치 1~4번에 해당합니다.
        </div>
      )}

      {/* 4지선다 보기 */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-gray-600">
          {q.questionSubtype === 'insert_text' ? '삽입 위치 (A=1번째 ■, B=2번째 ■...)' : '보기 (4지선다)'}
        </label>
        {q.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0 ${
              q.answer === String(opt.num) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}>
              {String.fromCharCode(65 + i)}
            </span>
            <input value={opt.text}
              onChange={e => onUpdateOption(i, e.target.value)}
              placeholder={
                q.questionSubtype === 'insert_text'
                  ? `위치 ${String.fromCharCode(65 + i)} (예: 1단락 끝 이후)`
                  : `Option ${String.fromCharCode(65 + i)}`
              }
              className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${ring} ${
                q.answer === String(opt.num) ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
              }`} />
          </div>
        ))}
      </div>

      {/* 정답 버튼 */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">정답</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(n => (
            <button key={n} type="button"
              onClick={() => onUpdate({ answer: String(n) })}
              className={`w-10 h-10 rounded-xl text-sm font-bold border-2 transition ${
                q.answer === String(n)
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-200 text-gray-600 hover:border-blue-300'
              }`}>
              {String.fromCharCode(64 + n)}
            </button>
          ))}
        </div>
      </div>

      {/* 해설 */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">해설</label>
        <textarea value={q.explanation} onChange={e => onUpdate({ explanation: e.target.value })}
          placeholder="정답 해설 및 오답 분석..." rows={2}
          className={`w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 ${ring} resize-none`} />
      </div>
    </div>
  )
}

// ────────── 메인 페이지 ──────────
export default function NewQuestionPage() {
  const router = useRouter()
  const supabase = createClient()

  const [category, setCategory] = useState<string>('reading')
  const [difficulty, setDifficulty] = useState(3)
  const [passage, setPassage] = useState('')

  // Reading/Listening: 지문 1개에 여러 문제
  const [mcQuestions, setMcQuestions] = useState<MCQuestion[]>([emptyMCQuestion()])
  const [expandedQ, setExpandedQ] = useState<number>(0)

  // Listening 필드
  const [audioScript, setAudioScript] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [generatingAudio, setGeneratingAudio] = useState(false)

  // Speaking/Writing 필드
  const [speakingPrompt, setSpeakingPrompt] = useState('')
  const [questionSubtype, setQuestionSubtype] = useState('')
  const [taskNumber, setTaskNumber] = useState(1)
  const [content, setContent] = useState('')
  const [answer, setAnswer] = useState('')
  const [explanation, setExplanation] = useState('')
  const [wordLimit, setWordLimit] = useState(150)
  const [writingTaskNumber, setWritingTaskNumber] = useState(1)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isReading = category === 'reading'
  const isListening = category === 'listening'
  const isSpeaking = category === 'speaking'
  const isWriting = category === 'writing'
  const isMC = isReading || isListening

  const speakingTimes = isSpeaking && questionSubtype ? SPEAKING_TASK_TIMES[questionSubtype] : null

  function handleCategoryChange(newCat: string) {
    setCategory(newCat)
    setQuestionSubtype('')
    setMcQuestions([emptyMCQuestion()])
    setExpandedQ(0)
    setPassage('')
    setAudioScript('')
    setAudioUrl('')
    setContent('')
    setAnswer('')
    setExplanation('')
    if (newCat === 'speaking') setTaskNumber(1)
    if (newCat === 'writing') setWritingTaskNumber(1)
  }

  // MC 문제 관리
  function addQuestion() {
    const newQ = emptyMCQuestion()
    // 마지막 문제와 같은 subtype 기본 설정 (prose_summary, fill_table은 1개만)
    const lastSub = mcQuestions[mcQuestions.length - 1]?.questionSubtype ?? ''
    if (!isProseSummary(lastSub) && !isFillTable(lastSub)) {
      newQ.questionSubtype = lastSub
    }
    setMcQuestions(prev => [...prev, newQ])
    setExpandedQ(mcQuestions.length)
  }

  function removeQuestion(idx: number) {
    if (mcQuestions.length <= 1) return
    setMcQuestions(prev => prev.filter((_, i) => i !== idx))
    setExpandedQ(prev => (prev >= idx && prev > 0 ? prev - 1 : prev))
  }

  function updateMCQ(idx: number, patch: Partial<MCQuestion>) {
    setMcQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...patch } : q))
  }

  function updateMCQOption(qIdx: number, optIdx: number, text: string) {
    setMcQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q
      const opts = [...q.options]
      opts[optIdx] = { ...opts[optIdx], text }
      return { ...q, options: opts }
    }))
  }

  function updateSummaryOption(qIdx: number, optIdx: number, text: string) {
    setMcQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q
      const opts = [...q.summaryOptions]
      opts[optIdx] = { ...opts[optIdx], text }
      return { ...q, summaryOptions: opts }
    }))
  }

  function toggleSummaryCorrect(qIdx: number, num: number) {
    setMcQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q
      const cur = q.summaryCorrect
      const next = cur.includes(num)
        ? cur.filter(n => n !== num)
        : cur.length < 3 ? [...cur, num] : cur
      return { ...q, summaryCorrect: next }
    }))
  }

  function updateTableCategory(qIdx: number, idx: number, val: string) {
    setMcQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q
      const cats = [...q.tableCategories] as [string, string, string]
      cats[idx] = val
      return { ...q, tableCategories: cats }
    }))
  }

  function updateTableItem(qIdx: number, idx: number, patch: Partial<{ text: string; category: string }>) {
    setMcQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q
      const items = [...q.tableItems]
      items[idx] = { ...items[idx], ...patch }
      return { ...q, tableItems: items }
    }))
  }

  async function generateAudio() {
    if (!audioScript.trim()) { setError('스크립트를 먼저 입력하세요.'); return }
    setGeneratingAudio(true); setError(''); setAudioUrl('')
    const res = await fetch('/api/ai/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script: audioScript, questionId: `temp_${Date.now()}` }),
    })
    if (res.ok) {
      const data = await res.json()
      setAudioUrl(data.audioUrl)
    } else {
      const err = await res.json().catch(() => ({}))
      setError(`음성 생성 실패: ${err.detail ?? err.error ?? '알 수 없는 오류'}`)
    }
    setGeneratingAudio(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (isMC) {
      const rows = mcQuestions
        .filter(q => q.content.trim() || isCompleteWords(q.questionSubtype))
        .map(q => {
          // answer 결정
          let finalAnswer = q.answer
          let finalOptions: { num: number; text: string }[] | null = q.options.filter(o => o.text.trim())

          if (isProseSummary(q.questionSubtype)) {
            finalAnswer = q.summaryCorrect.sort((a, b) => a - b).join(',')
            finalOptions = q.summaryOptions.filter(o => o.text.trim())
          } else if (isFillTable(q.questionSubtype)) {
            const categories = q.tableCategories.filter(c => c.trim())
            const items = q.tableItems.filter(it => it.text.trim())
            finalAnswer = JSON.stringify({ categories, assignments: Object.fromEntries(items.map((it, i) => [i + 1, it.category])) })
            finalOptions = items.map((it, i) => ({ num: i + 1, text: it.text }))
          } else if (isCompleteWords(q.questionSubtype)) {
            finalOptions = null
          }

          return {
            teacher_id: user.id,
            type: isCompleteWords(q.questionSubtype) ? 'essay' : 'multiple_choice',
            category,
            subcategory: null,
            difficulty,
            content: q.content,
            passage: passage || null,
            options: finalOptions,
            answer: finalAnswer,
            explanation: q.explanation || null,
            source: 'teacher',
            audio_url: audioUrl || null,
            audio_script: isListening ? (audioScript || null) : null,
            audio_play_limit: isListening ? 1 : null,
            speaking_prompt: null,
            preparation_time: null,
            response_time: null,
            word_limit: null,
            question_subtype: q.questionSubtype || null,
            task_number: null,
          }
        })

      if (rows.length === 0) { setError('최소 1개 문제를 입력하세요.'); setLoading(false); return }

      const { error: dbError } = await supabase.from('questions').insert(rows)
      if (dbError) { setError('저장 실패: ' + dbError.message); setLoading(false); return }
    } else {
      const { error: dbError } = await supabase.from('questions').insert({
        teacher_id: user.id,
        type: 'essay',
        category,
        subcategory: null,
        difficulty,
        content,
        passage: passage || null,
        options: null,
        answer: answer || '',
        explanation: explanation || null,
        source: 'teacher',
        audio_url: audioUrl || null,
        audio_script: audioScript || null,
        audio_play_limit: null,
        speaking_prompt: speakingPrompt || null,
        preparation_time: speakingTimes?.prep ?? null,
        response_time: speakingTimes?.response ?? null,
        word_limit: isWriting ? wordLimit : null,
        question_subtype: questionSubtype || null,
        task_number: isSpeaking ? taskNumber : isWriting ? writingTaskNumber : null,
      })
      if (dbError) { setError('저장 실패: ' + dbError.message); setLoading(false); return }
    }

    router.push('/teacher/questions')
    router.refresh()
  }

  // ─── 색상 테마 ───
  const colorMap: Record<string, { btn: string; ring: string; label: string }> = {
    reading:   { btn: 'bg-blue-600',    ring: 'ring-blue-500',    label: 'bg-blue-100 text-blue-700' },
    listening: { btn: 'bg-emerald-600', ring: 'ring-emerald-500', label: 'bg-emerald-100 text-emerald-700' },
    speaking:  { btn: 'bg-orange-600',  ring: 'ring-orange-500',  label: 'bg-orange-100 text-orange-700' },
    writing:   { btn: 'bg-purple-600',  ring: 'ring-purple-500',  label: 'bg-purple-100 text-purple-700' },
  }
  const theme = colorMap[category]

  return (
    <div className="p-7 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">TOEFL 문제 출제</h1>
        <p className="text-gray-500 text-sm mt-1">현행 + 2026 신규 유형 포함 TOEFL iBT 모든 형식 지원</p>
      </div>

      {/* 빈칸 문제 위저드 배너 */}
      <Link href="/teacher/questions/new/fill-blank"
        className="flex items-center gap-4 p-4 mb-5 bg-gradient-to-r from-teal-50 to-blue-50 border border-teal-200 rounded-2xl hover:from-teal-100 hover:to-blue-100 transition group">
        <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
          <Wand2 size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-teal-900 text-sm">빈칸 채우기 문제 출제 (인터랙티브 위저드)</p>
          <p className="text-xs text-teal-600 mt-0.5">원문 붙여넣기 → 클릭으로 빈칸 지정 → 5단계로 완성 (단락/문장 Set 모두 지원)</p>
        </div>
        <ChevronDown size={16} className="text-teal-400 -rotate-90 flex-shrink-0" />
      </Link>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">{error}</div>}

        {/* 섹션 + 난이도 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-900">TOEFL 섹션 설정</h2>

          <div className="grid grid-cols-4 gap-2">
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <button key={k} type="button" onClick={() => handleCategoryChange(k)}
                className={`py-2.5 rounded-xl text-sm font-bold transition ${
                  category === k ? colorMap[k].btn + ' text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}>
                {v}
              </button>
            ))}
          </div>

          {/* Speaking/Writing: 세부유형 */}
          {!isMC && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">과제 유형</label>
              <select value={questionSubtype}
                onChange={e => {
                  setQuestionSubtype(e.target.value)
                  if (isSpeaking) {
                    const subtypes = Object.keys(QUESTION_SUBTYPE_LABELS.speaking)
                    setTaskNumber(subtypes.indexOf(e.target.value) + 1)
                  }
                  if (isWriting) setWritingTaskNumber(e.target.value === 'academic_discussion' ? 2 : 1)
                }}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">선택하세요</option>
                {QUESTION_SUBTYPE_LABELS[category] &&
                  Object.entries(QUESTION_SUBTYPE_LABELS[category]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))
                }
              </select>
            </div>
          )}

          {/* 난이도 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">난이도 (TOEFL 점수대)</label>
            <div className="flex gap-1">
              {[{ d: 1, label: '50-60' }, { d: 2, label: '60-80' }, { d: 3, label: '80-90' }, { d: 4, label: '90-100' }, { d: 5, label: '100+' }]
                .map(({ d, label }) => (
                  <button key={d} type="button" onClick={() => setDifficulty(d)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${d <= difficulty ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {label}
                  </button>
                ))}
            </div>
          </div>

          {isSpeaking && speakingTimes && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
              <p className="text-sm text-orange-800 font-semibold">
                Task {taskNumber}: 준비 {speakingTimes.prep}초 → 응답 {speakingTimes.response}초
              </p>
            </div>
          )}
          {isWriting && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 space-y-2">
              <p className="text-sm text-purple-800 font-semibold">
                Task {writingTaskNumber}: {writingTaskNumber === 1 ? '20분 (Integrated)' : '10분 (Academic Discussion)'}
              </p>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-600">최소 단어 수</label>
                <input type="number" value={wordLimit} onChange={e => setWordLimit(Number(e.target.value))}
                  className="w-24 px-2 py-1.5 border border-purple-200 rounded-lg text-sm" />
              </div>
            </div>
          )}
        </div>

        {/* ═══════════ READING ═══════════ */}
        {isReading && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-bold text-gray-900 mb-1">학술 지문 (Passage)</h2>
              <p className="text-xs text-gray-400 mb-3">
                공유 지문입니다. 모든 문제에 동일 지문이 사용됩니다.
                Insert Text는 지문에 ■ 기호로 삽입 위치를 표시하세요.
              </p>
              <UnderlineTextarea value={passage} onChange={setPassage}
                placeholder="700단어 이상의 학술 지문을 입력하세요. Insert Text 유형은 ■ 기호로 4군데 위치를 표시하세요..."
                rows={12} />
            </div>

            {/* 문제 목록 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-900">문제 ({mcQuestions.length}개)</h2>
                <button type="button" onClick={addQuestion}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition">
                  <Plus size={14} /> 문제 추가
                </button>
              </div>

              {mcQuestions.map((q, qIdx) => {
                const badge = SUBTYPE_BADGE[q.questionSubtype] ?? 'bg-gray-100 text-gray-600'
                const subtypeLabel = (QUESTION_SUBTYPE_LABELS[category] ?? {})[q.questionSubtype] ?? ''
                return (
                  <div key={qIdx} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <button type="button"
                      onClick={() => setExpandedQ(expandedQ === qIdx ? -1 : qIdx)}
                      className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-7 h-7 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full text-xs font-bold flex-shrink-0">
                          {qIdx + 1}
                        </span>
                        {subtypeLabel && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${badge}`}>
                            {subtypeLabel.replace(' ★NEW', '')}
                          </span>
                        )}
                        <span className="text-sm font-medium text-gray-700 text-left line-clamp-1">
                          {q.content || isCompleteWords(q.questionSubtype) ? (q.content || '(단락 빈칸 채우기)') : '(문제를 입력하세요)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {q.answer && !isFillTable(q.questionSubtype) && !isProseSummary(q.questionSubtype) && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
                            {isCompleteWords(q.questionSubtype) ? '정답있음' : `정답: ${String.fromCharCode(64 + Number(q.answer))}`}
                          </span>
                        )}
                        {isProseSummary(q.questionSubtype) && q.summaryCorrect.length > 0 && (
                          <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-bold">
                            {q.summaryCorrect.length}/3 선택
                          </span>
                        )}
                        {mcQuestions.length > 1 && (
                          <button type="button" onClick={e => { e.stopPropagation(); removeQuestion(qIdx) }}
                            className="p-1 text-gray-400 hover:text-red-500 transition">
                            <Trash2 size={14} />
                          </button>
                        )}
                        {expandedQ === qIdx ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </div>
                    </button>

                    {expandedQ === qIdx && (
                      <div className="px-5 pb-5 pt-2 border-t border-gray-100">
                        {/* 세부유형 선택 - prose_summary, fill_table, complete_the_words는 헤더에서 */}
                        {!isProseSummary(q.questionSubtype) && !isFillTable(q.questionSubtype) && !isCompleteWords(q.questionSubtype) && (
                          <div className="mb-4">
                            <label className="block text-xs font-semibold text-gray-600 mb-1">문제 유형</label>
                            <select value={q.questionSubtype}
                              onChange={e => updateMCQ(qIdx, { questionSubtype: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                              <option value="">선택하세요</option>
                              {Object.entries(QUESTION_SUBTYPE_LABELS[category]).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {(isProseSummary(q.questionSubtype) || isFillTable(q.questionSubtype) || isCompleteWords(q.questionSubtype)) && (
                          <div className="mb-4">
                            <select value={q.questionSubtype}
                              onChange={e => updateMCQ(qIdx, { questionSubtype: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                              {Object.entries(QUESTION_SUBTYPE_LABELS[category]).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        <QuestionEditor
                          q={q} qIdx={qIdx} category={category} color="blue"
                          onUpdate={patch => updateMCQ(qIdx, patch)}
                          onUpdateOption={(optIdx, text) => updateMCQOption(qIdx, optIdx, text)}
                          onUpdateSummaryOption={(optIdx, text) => updateSummaryOption(qIdx, optIdx, text)}
                          onToggleSummaryCorrect={num => toggleSummaryCorrect(qIdx, num)}
                          onUpdateTableCategory={(idx, val) => updateTableCategory(qIdx, idx, val)}
                          onUpdateTableItem={(idx, patch) => updateTableItem(qIdx, idx, patch)}
                        />
                      </div>
                    )}
                  </div>
                )
              })}

              <button type="button" onClick={addQuestion}
                className="w-full py-3 border-2 border-dashed border-blue-200 rounded-xl text-sm font-semibold text-gray-400 hover:border-blue-400 hover:text-blue-500 transition">
                + 문제 추가 (TOEFL Reading은 지문당 최대 10문제)
              </button>
            </div>
          </>
        )}

        {/* ═══════════ LISTENING ═══════════ */}
        {isListening && (
          <>
            <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Volume2 size={18} className="text-emerald-600" />
                <h2 className="font-bold text-emerald-900">Listening 오디오</h2>
              </div>
              <p className="text-xs text-gray-500">강의(6문제) 또는 대화(5문제). TOEFL Listening은 1회만 재생됩니다.</p>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  오디오 스크립트 <span className="text-red-500">*</span>
                </label>
                <textarea value={audioScript} onChange={e => setAudioScript(e.target.value)}
                  placeholder="강의 또는 대화 스크립트를 입력하세요..."
                  rows={8}
                  className="w-full px-3 py-2.5 border border-emerald-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none bg-white" />
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <button type="button" onClick={generateAudio}
                  disabled={generatingAudio || !audioScript.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl text-sm font-bold transition">
                  {generatingAudio ? <><Loader2 size={15} className="animate-spin" /> 생성 중...</> : <><Volume2 size={15} /> AI 음성 생성</>}
                </button>
                {audioUrl && (
                  <div className="flex items-center gap-2 bg-white border border-emerald-200 rounded-xl px-3 py-2">
                    <span className="text-xs font-bold text-emerald-700">생성 완료</span>
                    <audio controls src={audioUrl} className="h-8 max-w-xs" />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-900">문제 ({mcQuestions.length}개)</h2>
                <button type="button" onClick={addQuestion}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition">
                  <Plus size={14} /> 문제 추가
                </button>
              </div>

              {mcQuestions.map((q, qIdx) => (
                <div key={qIdx} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <button type="button"
                    onClick={() => setExpandedQ(expandedQ === qIdx ? -1 : qIdx)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 h-7 flex items-center justify-center bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold flex-shrink-0">
                        {qIdx + 1}
                      </span>
                      <span className="text-sm font-medium text-gray-700 text-left line-clamp-1">
                        {q.content || '(문제를 입력하세요)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {q.answer && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">정답: {String.fromCharCode(64 + Number(q.answer))}</span>}
                      {mcQuestions.length > 1 && (
                        <button type="button" onClick={e => { e.stopPropagation(); removeQuestion(qIdx) }}
                          className="p-1 text-gray-400 hover:text-red-500 transition">
                          <Trash2 size={14} />
                        </button>
                      )}
                      {expandedQ === qIdx ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </div>
                  </button>

                  {expandedQ === qIdx && (
                    <div className="px-5 pb-5 pt-2 border-t border-gray-100">
                      <div className="mb-4">
                        <select value={q.questionSubtype}
                          onChange={e => updateMCQ(qIdx, { questionSubtype: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                          <option value="">유형 선택</option>
                          {Object.entries(QUESTION_SUBTYPE_LABELS[category]).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>
                      <QuestionEditor
                        q={q} qIdx={qIdx} category={category} color="emerald"
                        onUpdate={patch => updateMCQ(qIdx, patch)}
                        onUpdateOption={(optIdx, text) => updateMCQOption(qIdx, optIdx, text)}
                        onUpdateSummaryOption={(optIdx, text) => updateSummaryOption(qIdx, optIdx, text)}
                        onToggleSummaryCorrect={num => toggleSummaryCorrect(qIdx, num)}
                        onUpdateTableCategory={(idx, val) => updateTableCategory(qIdx, idx, val)}
                        onUpdateTableItem={(idx, patch) => updateTableItem(qIdx, idx, patch)}
                      />
                    </div>
                  )}
                </div>
              ))}

              <button type="button" onClick={addQuestion}
                className="w-full py-3 border-2 border-dashed border-emerald-200 rounded-xl text-sm font-semibold text-gray-400 hover:border-emerald-400 hover:text-emerald-500 transition">
                + 문제 추가 (강의당 6문제, 대화당 5문제)
              </button>
            </div>
          </>
        )}

        {/* ═══════════ SPEAKING ═══════════ */}
        {isSpeaking && (
          <div className="bg-orange-50 rounded-2xl border border-orange-200 p-5 space-y-4">
            <h2 className="font-bold text-orange-900">Speaking 과제</h2>

            {/* 2026 Listen & Repeat */}
            {questionSubtype === 'listen_and_repeat' && (
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-xs text-teal-700">
                <strong>★ 2026 신규:</strong> 학생이 들은 문장을 그대로 반복합니다. 오디오 스크립트를 입력하면 TTS로 변환됩니다.
              </div>
            )}
            {questionSubtype === 'take_an_interview' && (
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-xs text-teal-700">
                <strong>★ 2026 신규:</strong> 인터뷰 형식 질문에 응답합니다. 일상적인 주제를 사용합니다.
              </div>
            )}

            {taskNumber >= 2 && taskNumber <= 3 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">읽기 지문 (Read) <span className="text-red-500">*</span></label>
                <textarea value={passage} onChange={e => setPassage(e.target.value)}
                  placeholder={taskNumber === 2 ? '캠퍼스 공지문 또는 학교 정책 지문 (~100 words)' : '학술 지문 (~100 words)'}
                  rows={5}
                  className="w-full px-3 py-2.5 border border-orange-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none bg-white" />
              </div>
            )}

            {(taskNumber >= 2 || questionSubtype === 'listen_and_repeat') && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">오디오 스크립트 <span className="text-red-500">*</span></label>
                <textarea value={audioScript} onChange={e => setAudioScript(e.target.value)}
                  placeholder={questionSubtype === 'listen_and_repeat' ? '학생이 반복할 문장을 입력하세요' : taskNumber === 2 ? '학생 대화 스크립트' : '교수 강의 스크립트'}
                  rows={6}
                  className="w-full px-3 py-2.5 border border-orange-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none bg-white" />
                <div className="mt-2 flex items-center gap-3">
                  <button type="button" onClick={generateAudio} disabled={generatingAudio || !audioScript.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white rounded-xl text-sm font-bold transition">
                    {generatingAudio ? <><Loader2 size={15} className="animate-spin" /> 생성 중...</> : <><Volume2 size={15} /> AI 음성 생성</>}
                  </button>
                  {audioUrl && <span className="text-xs font-bold text-emerald-700">생성 완료 ✓</span>}
                </div>
              </div>
            )}

            {questionSubtype !== 'listen_and_repeat' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Speaking 프롬프트 <span className="text-red-500">*</span></label>
                <textarea value={speakingPrompt} onChange={e => setSpeakingPrompt(e.target.value)}
                  placeholder={taskNumber === 1
                    ? 'Some people prefer to study alone, while others prefer to study in a group. Which do you prefer and why?'
                    : questionSubtype === 'take_an_interview'
                    ? 'Tell me about a skill you have learned recently. How did you learn it?'
                    : 'Using points and examples from the lecture, explain how...'}
                  rows={3}
                  className="w-full px-3 py-2.5 border border-orange-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none bg-white" />
              </div>
            )}
          </div>
        )}

        {/* ═══════════ WRITING ═══════════ */}
        {isWriting && (
          <div className="bg-purple-50 rounded-2xl border border-purple-200 p-5 space-y-4">
            <h2 className="font-bold text-purple-900">Writing 과제</h2>

            {writingTaskNumber === 1 && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">읽기 지문 (250-300 words) <span className="text-red-500">*</span></label>
                  <UnderlineTextarea value={passage} onChange={setPassage}
                    placeholder="학술 주제에 대한 읽기 지문 (250-300 words)..."
                    rows={8} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">강의 스크립트 <span className="text-red-500">*</span></label>
                  <textarea value={audioScript} onChange={e => setAudioScript(e.target.value)}
                    placeholder="읽기 지문의 주장을 반박하는 강의 스크립트 (1-2분 분량)"
                    rows={6}
                    className="w-full px-3 py-2.5 border border-purple-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none bg-white" />
                  <div className="mt-2 flex items-center gap-3">
                    <button type="button" onClick={generateAudio} disabled={generatingAudio || !audioScript.trim()}
                      className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-xl text-sm font-bold transition">
                      {generatingAudio ? <><Loader2 size={15} className="animate-spin" /> 생성 중...</> : <><Volume2 size={15} /> AI 음성 생성</>}
                    </button>
                    {audioUrl && <span className="text-xs font-bold text-emerald-700">생성 완료 ✓</span>}
                  </div>
                </div>
              </>
            )}

            {writingTaskNumber === 2 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">토론 배경 <span className="text-red-500">*</span></label>
                <UnderlineTextarea value={passage} onChange={setPassage}
                  placeholder={`Dr. Johnson:\nIn today's class, we discussed...\n\nStudent A (Alex):\nI think that...\n\nStudent B (Maria):\nI disagree because...`}
                  rows={10} />
              </div>
            )}
          </div>
        )}

        {/* Speaking/Writing: 지시문 + 모범답변 */}
        {(isSpeaking || isWriting) && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-gray-900">문제 지시문 + 모범답변</h2>
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder={isSpeaking
                ? questionSubtype === 'listen_and_repeat' ? '(자동 채점 — 스크립트와 동일)'
                : 'Using the reading passage and the lecture, explain...'
                : writingTaskNumber === 1
                ? 'Summarize the points made in the lecture, being sure to explain how they cast doubt on the specific points made in the reading passage.'
                : 'Write a response that contributes to the discussion. Express and support your opinion...'}
              rows={3} required
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">모범 답변 (채점 참고용)</label>
              <textarea value={answer} onChange={e => setAnswer(e.target.value)}
                placeholder="모범 답변을 영어로 작성하세요..." rows={5}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">채점 포인트 (한국어)</label>
              <textarea value={explanation} onChange={e => setExplanation(e.target.value)}
                placeholder="채점 기준 및 핵심 포인트..." rows={3}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          </div>
        )}

        {/* 저장 버튼 */}
        <div className="flex gap-3 pb-6">
          <button type="button" onClick={() => router.back()}
            className="px-6 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
            취소
          </button>
          <button type="submit" disabled={loading}
            className={`flex-1 text-white font-bold py-3 rounded-xl transition text-sm ${theme.btn} hover:opacity-90 disabled:opacity-50`}>
            {loading ? '저장 중...' : isMC ? `${mcQuestions.filter(q => q.content.trim() || isCompleteWords(q.questionSubtype)).length}개 문제 저장` : '문제 저장'}
          </button>
        </div>
      </form>
    </div>
  )
}
