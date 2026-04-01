'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Zap, X, ChevronRight, Save, Info, ChevronDown,
  BookOpen, AlignLeft, Globe, ArrowUp, ArrowDown,
  Loader2, CheckCircle2, AlertCircle, Headphones, FileText,
  PenLine, Mic, Plus, Minus, Clock,
} from 'lucide-react'
import { DIFFICULTY_LEVELS, getDiffInfo, DEFAULT_TIME_LIMITS, AUDIO_BUFFER, formatSeconds } from '@/lib/utils'
import ListeningCanvas, {
  type ListeningModSlots, emptyListeningMod,
} from './ListeningCanvas'
import WritingCanvas, {
  type WritingSlots, emptyWritingSlots,
} from './WritingCanvas'
import SpeakingCanvas, {
  type SpeakingSlots, emptySpeakingSlots,
} from './SpeakingCanvas'
import QuestionPickerModal, { type PickedQuestion } from './QuestionPickerModal'

// ─── 타입 ───────────────────────────────────────────
interface SlotQ {
  id: string
  content: string
  difficulty: number
  question_subtype: string | null
  passage_id: string | null
  type: string
}

interface ModuleSlots {
  fillBlank:  (SlotQ | null)[]   // 10개
  dailyLife?: (SlotQ | null)[]   // 5개 (M1 전용)
  deep:       (SlotQ | null)[]   // 5개
}

interface ClassInfo { id: string; name: string; target_band: number | null }

// ─── 상수 ───────────────────────────────────────────
// DIFFICULTY_LEVELS를 lib/utils에서 가져오므로 여기서는 헬퍼만 정의
const DIFF_VALUES = DIFFICULTY_LEVELS.map(l => l.value)  // [1.0, 1.5, ..., 6.0]

function snapBand(v: number): number {
  // 0.5 단위 스냅 + 범위 고정 1.0~6.0
  return Math.round(Math.max(1.0, Math.min(6.0, v)) * 2) / 2
}

const TEST_TYPES = [
  { v: 'weekly',  label: '주간 테스트', desc: 'Max Band: T+0.5' },
  { v: 'monthly', label: '월말 평가',   desc: 'Max Band: T+1.0' },
  { v: 'mock',    label: '모의고사',    desc: 'Max Band: T+2.0' },
] as const
type TestType = typeof TEST_TYPES[number]['v']

function defaultMaxBand(t: number, type: TestType) {
  return snapBand(t + (type === 'weekly' ? 0.5 : type === 'monthly' ? 1.0 : 2.0))
}

const emptyModule = (hasDailyLife: boolean): ModuleSlots => ({
  fillBlank: Array(2).fill(null),   // 각 슬롯 = sentence_completion 1세트 (~10문장)
  ...(hasDailyLife ? { dailyLife: Array(5).fill(null) } : {}),
  deep: Array(5).fill(null),
})

// 슬롯별 elastic 범위
const SLOT_RANGE: Record<string, { min: number; max: number }> = {
  fillBlank: { min: 1, max: 4  },   // SET 슬롯: 최소 1세트, 최대 4세트
  dailyLife: { min: 3, max: 7  },
  deep:      { min: 3, max: 8  },
}

// 문제 피커에서 보여줄 서브타입 (현행 유형만)
const READING_SUBTYPES: Record<string, string[]> = {
  fillBlank: ['complete_the_words', 'sentence_completion'],
  dailyLife: ['daily_life_email', 'daily_life_text_chain', 'daily_life_notice', 'daily_life_guide', 'daily_life_article', 'daily_life_campus_notice'],
  deep:      ['academic_passage'],
}

// ─── 서브 컴포넌트: 배지 ────────────────────────────
function BandBadge({ d }: { d: number }) {
  const info = getDiffInfo(d)
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${info.color}`}>
      {info.level} · {info.label}
    </span>
  )
}

// ─── 서브 컴포넌트: 슬롯 카드 ───────────────────────
function SlotCard({
  idx, q, onSwap, onRemove, onPickOpen,
}: {
  idx: number
  q: SlotQ | null
  onSwap: () => void
  onRemove: () => void
  onPickOpen: () => void
}) {
  if (!q) {
    return (
      <button
        onClick={onPickOpen}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-200 text-xs text-gray-300 bg-gray-50 hover:border-blue-300 hover:text-blue-400 hover:bg-blue-50 transition">
        <span className="w-5 text-center font-bold">{idx + 1}</span>
        <span>빈 슬롯 — 클릭하여 직접 선택</span>
      </button>
    )
  }
  // sentence_completion: 10문장 세트 — 첫 문장만 미리보기
  const isSentenceSet = q.question_subtype === 'sentence_completion'
  const sentenceCount = isSentenceSet ? q.content.split('\n').filter(Boolean).length : 0
  const previewText = isSentenceSet
    ? q.content.split('\n').find(Boolean) ?? q.content
    : q.content

  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-white hover:border-blue-200 transition group">
      <span className="w-5 text-center text-xs font-bold text-gray-400 mt-0.5 flex-shrink-0">{idx + 1}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-700 line-clamp-2 leading-snug">{previewText}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <BandBadge d={q.difficulty} />
          {isSentenceSet && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
              {sentenceCount}문장 세트
            </span>
          )}
          {q.question_subtype && !isSentenceSet && (
            <span className="text-[10px] text-gray-400">{q.question_subtype.replace(/_/g, ' ')}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
        <button onClick={onPickOpen}
          className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded hover:bg-purple-100 font-bold transition">
          직접 교체
        </button>
        <button onClick={onSwap}
          className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 font-bold transition">
          교체
        </button>
        <button onClick={onRemove}
          className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-500 rounded hover:bg-red-100 font-bold transition">
          제거
        </button>
      </div>
    </div>
  )
}

// ─── 서브 컴포넌트: 슬롯 그룹 ───────────────────────
function SlotGroup({
  label, icon, slots, slotType, filling, onFill, onSwapOpen, onRemove, onResize, onPickOpen,
}: {
  label: string
  icon: React.ReactNode
  slots: (SlotQ | null)[]
  slotType: string
  filling: boolean
  onFill: () => void
  onSwapOpen: (idx: number, q: SlotQ) => void
  onRemove: (idx: number) => void
  onResize: (delta: 1 | -1) => void
  onPickOpen: (idx: number) => void
}) {
  const filled = slots.filter(Boolean).length
  const range = SLOT_RANGE[slotType] ?? { min: 3, max: 20 }
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500">{icon}</span>
          <span className="text-xs font-bold text-gray-700">{label}</span>
          {/* Speaking 스타일 카운터 */}
          <div className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg px-1 py-0.5">
            <button onClick={() => onResize(-1)} disabled={slots.length <= range.min}
              className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-800 disabled:opacity-30 transition">
              <Minus size={9} />
            </button>
            <span className="text-[11px] font-bold text-gray-700 w-5 text-center">{slots.length}</span>
            <button onClick={() => onResize(1)} disabled={slots.length >= range.max}
              className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-800 disabled:opacity-30 transition">
              <Plus size={9} />
            </button>
          </div>
          <span className="text-[10px] text-gray-400">{filled}개 채움</span>
        </div>
        <button onClick={onFill} disabled={filling} title="Magic Fill"
          className="inline-flex items-center justify-center w-7 h-7
            bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition">
          {filling ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
        </button>
      </div>
      <div className="space-y-1.5">
        {slots.map((q, i) => (
          <SlotCard key={i} idx={i} q={q}
            onSwap={() => q && onSwapOpen(i, q)}
            onRemove={() => onRemove(i)}
            onPickOpen={() => onPickOpen(i)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── 메인 페이지 ─────────────────────────────────────
export default function SmartBuilderPage() {
  const router = useRouter()
  const supabase = createClient()

  // 설정
  const [examTitle, setExamTitle]   = useState('')
  const [classes, setClasses]       = useState<ClassInfo[]>([])
  const [classId, setClassId]       = useState('')
  const [testType, setTestType]     = useState<TestType>('weekly')
  const [targetBand, setTargetBand] = useState(3.0)   // FLOAT
  const [maxBand, setMaxBand]       = useState(3.5)   // FLOAT

  // 탭
  const [activeTab, setActiveTab] = useState<'reading' | 'listening' | 'writing' | 'speaking'>('reading')

  // Reading 슬롯
  const [m1, setM1]       = useState<ModuleSlots>(emptyModule(true))
  const [m2up, setM2Up]   = useState<ModuleSlots>(emptyModule(false))
  const [m2down, setM2Down] = useState<ModuleSlots>(emptyModule(false))

  // Listening 슬롯
  const [lm1, setLM1]       = useState<ListeningModSlots>(emptyListeningMod(12, 4, 3))
  const [lm2up, setLM2Up]   = useState<ListeningModSlots>(emptyListeningMod(3, 4, 2))
  const [lm2down, setLM2Down] = useState<ListeningModSlots>(emptyListeningMod(3, 4, 2))

  // Writing 슬롯 (단일 경로)
  const [writingSlots, setWritingSlots] = useState<WritingSlots>(emptyWritingSlots())

  // Speaking 슬롯 (단일 경로)
  const [speakingSlots, setSpeakingSlots] = useState<SpeakingSlots>(emptySpeakingSlots())

  // UI
  const [filling, setFilling] = useState<string | null>(null)
  const [swapState, setSwapState] = useState<{
    module: 'M1'|'M2up'|'M2down'; slotType: string; idx: number; q: SlotQ; candidates: SlotQ[]
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [pickerState, setPickerState] = useState<{
    module: 'M1' | 'M2up' | 'M2down'
    slotType: 'fillBlank' | 'dailyLife' | 'deep'
    idx: number
  } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [activeModule, setActiveModule] = useState<'M1' | 'M2up' | 'M2down'>('M1')

  // 클래스 목록 로드
  useEffect(() => {
    supabase.from('classes').select('id, name, target_band').then(({ data }) => {
      if (data) setClasses(data)
    })
  }, [])

  // 클래스 선택 시 target_band 자동 설정
  useEffect(() => {
    const cls = classes.find(c => c.id === classId)
    if (cls?.target_band) {
      setTargetBand(cls.target_band)
      setMaxBand(defaultMaxBand(cls.target_band, testType))
    }
  }, [classId, classes])

  // testType 변경 시 maxBand 재계산
  useEffect(() => {
    setMaxBand(defaultMaxBand(targetBand, testType))
  }, [testType, targetBand])

  // Listening 세트에서 문제 ID 추출 헬퍼
  function listenIds(mod: ListeningModSlots) {
    return [
      ...mod.response.filter(Boolean).map(q => q!.id),
      ...mod.conversation.filter(Boolean).flatMap(s => s!.questions.map(q => q.id)),
      ...mod.academicTalk.filter(Boolean).flatMap(s => s!.questions.map(q => q.id)),
    ]
  }

  // 현재 모든 채워진 슬롯 ID (Reading + Listening + Writing + Speaking 합산)
  const allIds = [
    ...m1.fillBlank, ...(m1.dailyLife ?? []), ...m1.deep,
    ...m2up.fillBlank, ...m2up.deep,
    ...m2down.fillBlank, ...m2down.deep,
  ].filter(Boolean).map(q => q!.id).concat(
    listenIds(lm1), listenIds(lm2up), listenIds(lm2down),
    [...writingSlots.reordering, ...writingSlots.email].filter(Boolean).map(q => q!.id),
    [...speakingSlots.listenRepeat, ...speakingSlots.interview].filter(Boolean).map(q => q!.id),
  )

  // ── Magic Fill ──────────────────────────────────────
  async function magicFill(
    module: 'M1' | 'M2up' | 'M2down',
    slotType: 'fillBlank' | 'dailyLife' | 'deep',
  ) {
    const key = `${module}_${slotType}`
    setFilling(key)

    try {
      const apiSlotType = slotType === 'fillBlank' ? 'fill_blank'
        : slotType === 'dailyLife' ? 'daily_life' : 'deep_reading'

      const current = module === 'M1' ? m1 : module === 'M2up' ? m2up : m2down
      const slots = current[slotType] ?? []
      const emptyCount = slots.filter(s => !s).length
      if (emptyCount === 0) return

      const res = await fetch('/api/teacher/smart-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId, targetBand, maxBand,
          module, slotType: apiSlotType,
          count: emptyCount,
          excludeIds: allIds,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }

      const newQs: SlotQ[] = data.questions
      let qi = 0
      const updated = slots.map(s => s ?? (newQs[qi++] ?? null))

      const setter = module === 'M1' ? setM1 : module === 'M2up' ? setM2Up : setM2Down
      setter(prev => ({ ...prev, [slotType]: updated }))
    } catch (e) {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setFilling(null)   // ← 어떤 경우에도 반드시 해제
    }
  }

  // ── Smart Swap 열기 ─────────────────────────────────
  async function openSwap(
    module: 'M1'|'M2up'|'M2down', slotType: string, idx: number, q: SlotQ,
  ) {
    const apiSlotType = slotType === 'fillBlank' ? 'fill_blank'
      : slotType === 'dailyLife' ? 'daily_life' : 'deep_reading'
    const res = await fetch('/api/teacher/smart-swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ difficulty: q.difficulty, slotType: apiSlotType, excludeIds: allIds }),
    })
    const data = await res.json()
    setSwapState({ module, slotType, idx, q, candidates: data.candidates ?? [] })
  }

  // ── 슬롯 제거 ──────────────────────────────────────
  function removeSlot(module: 'M1'|'M2up'|'M2down', slotType: string, idx: number) {
    const setter = module === 'M1' ? setM1 : module === 'M2up' ? setM2Up : setM2Down
    setter(prev => {
      const arr = [...(prev[slotType as keyof ModuleSlots] ?? [])] as (SlotQ | null)[]
      arr[idx] = null
      return { ...prev, [slotType]: arr }
    })
  }

  // ── 슬롯 수 조절 (Elastic) ─────────────────────────
  function resizeReadingSlot(
    module: 'M1'|'M2up'|'M2down',
    slotType: 'fillBlank'|'dailyLife'|'deep',
    delta: 1 | -1,
  ) {
    const setter = module === 'M1' ? setM1 : module === 'M2up' ? setM2Up : setM2Down
    setter(prev => {
      const arr = [...(prev[slotType] ?? [])] as (SlotQ | null)[]
      if (delta === 1) {
        arr.push(null)
      } else {
        // 뒤에서 빈 슬롯 먼저 제거
        const lastNull = [...arr].map((q, i) => ({ q, i })).reverse().find(x => !x.q)?.i
        if (lastNull !== undefined) arr.splice(lastNull, 1)
        else arr.pop()
      }
      return { ...prev, [slotType]: arr }
    })
  }

  // ── 슬롯 교체 (swap 팝업에서) ──────────────────────
  function applySwap(candidate: SlotQ) {
    if (!swapState) return
    const { module, slotType, idx } = swapState
    const setter = module === 'M1' ? setM1 : module === 'M2up' ? setM2Up : setM2Down
    setter(prev => {
      const arr = [...(prev[slotType as keyof ModuleSlots] ?? [])] as (SlotQ | null)[]
      arr[idx] = candidate
      return { ...prev, [slotType]: arr }
    })
    setSwapState(null)
  }

  function handlePickSelect(picked: PickedQuestion) {
    if (!pickerState) return
    const { module, slotType, idx } = pickerState
    const q: SlotQ = {
      id: picked.id,
      content: picked.content,
      difficulty: picked.difficulty,
      question_subtype: picked.question_subtype,
      passage_id: null,
      type: picked.type,
    }
    const setter = module === 'M1' ? setM1 : module === 'M2up' ? setM2Up : setM2Down
    setter(prev => {
      const arr = [...(prev[slotType as keyof ModuleSlots] ?? [])] as (SlotQ | null)[]
      arr[idx] = q
      return { ...prev, [slotType]: arr }
    })
    setPickerState(null)
  }

  // ── 세트/다중 선택 — idx부터 연속 슬롯에 채우기 (상한값 내 자동 확장) ──
  function handlePickSelectSet(picked: PickedQuestion[]) {
    if (!pickerState) return
    const { module, slotType, idx } = pickerState
    const maxCount = SLOT_RANGE[slotType]?.max ?? 20
    const setter = module === 'M1' ? setM1 : module === 'M2up' ? setM2Up : setM2Down
    setter(prev => {
      const arr = [...(prev[slotType as keyof ModuleSlots] ?? [])] as (SlotQ | null)[]
      const needed = idx + picked.length
      while (arr.length < needed && arr.length < maxCount) arr.push(null)
      picked.forEach((p, offset) => {
        const targetIdx = idx + offset
        if (targetIdx < arr.length) {
          arr[targetIdx] = { id: p.id, content: p.content, difficulty: p.difficulty, question_subtype: p.question_subtype, passage_id: null, type: p.type }
        }
      })
      return { ...prev, [slotType]: arr }
    })
    setPickerState(null)
  }

  // ── 시험 저장 ──────────────────────────────────────
  async function saveExam() {
    if (!examTitle.trim()) { setError('시험 제목을 입력하세요.'); return }
    setSaving(true); setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setError('로그인이 필요합니다.'); return }
      const user = session.user

      // M1 questions → exam_questions
      const m1Questions = [
        ...m1.fillBlank, ...(m1.dailyLife ?? []), ...m1.deep
      ].filter(Boolean) as SlotQ[]

      const serializeListening = (mod: ListeningModSlots) => ({
        response: mod.response.filter(Boolean).map(q => q!.id),
        conversation: mod.conversation.filter(Boolean).map(s => ({
          audioId: s!.audioId, audioUrl: s!.audioUrl, questionIds: s!.questions.map(q => q.id),
        })),
        academicTalk: mod.academicTalk.filter(Boolean).map(s => ({
          audioId: s!.audioId, audioUrl: s!.audioUrl, questionIds: s!.questions.map(q => q.id),
        })),
      })

      const adaptiveConfig = {
        adaptive: true, targetBand, maxBand, testType,
        m1Ids: m1Questions.map(q => q.id),
        m2upIds:   [...m2up.fillBlank, ...m2up.deep].filter(Boolean).map(q => q!.id),
        m2downIds: [...m2down.fillBlank, ...m2down.deep].filter(Boolean).map(q => q!.id),
        listening_m1:    serializeListening(lm1),
        listening_m2up:  serializeListening(lm2up),
        listening_m2down: serializeListening(lm2down),
        writing: {
          reorderingIds: writingSlots.reordering.filter(Boolean).map(q => q!.id),
          emailIds:      writingSlots.email.filter(Boolean).map(q => q!.id),
        },
        speaking: {
          listenRepeatIds: speakingSlots.listenRepeat.filter(Boolean).map(q => q!.id),
          interviewIds:    speakingSlots.interview.filter(Boolean).map(q => q!.id),
        },
      }

      // 학생이 실제 받는 문제 (M1 + LM1 + Writing + Speaking)의 시간 합산
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const calcTimeSecs = (qs: any[]) =>
        qs.filter(Boolean).reduce((s: number, q: any) => {
          const sub = q?.question_subtype ?? ''
          return s + (DEFAULT_TIME_LIMITS[sub] ?? 0) + (AUDIO_BUFFER[sub] ?? 0)
        }, 0)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lm1Questions: any[] = [
        ...lm1.response,
        ...lm1.conversation.flatMap((a: any) => a?.questions ?? []),
        ...lm1.academicTalk.flatMap((a: any) => a?.questions ?? []),
      ]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lm2upQuestions: any[] = [
        ...lm2up.response,
        ...lm2up.conversation.flatMap((a: any) => a?.questions ?? []),
        ...lm2up.academicTalk.flatMap((a: any) => a?.questions ?? []),
      ]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lm2downQuestions: any[] = [
        ...lm2down.response,
        ...lm2down.conversation.flatMap((a: any) => a?.questions ?? []),
        ...lm2down.academicTalk.flatMap((a: any) => a?.questions ?? []),
      ]
      // 학생은 M2up/M2down 중 하나, LM2up/LM2down 중 하나만 풀므로 더 긴 쪽 사용
      const m2Secs = Math.max(
        calcTimeSecs([...m2up.fillBlank, ...m2up.deep]),
        calcTimeSecs([...m2down.fillBlank, ...m2down.deep])
      )
      const lm2Secs = Math.max(calcTimeSecs(lm2upQuestions), calcTimeSecs(lm2downQuestions))
      const totalSecs =
        calcTimeSecs(m1Questions) +
        m2Secs +
        calcTimeSecs(lm1Questions) +
        lm2Secs +
        calcTimeSecs([...writingSlots.reordering, ...writingSlots.email]) +
        calcTimeSecs([...speakingSlots.listenRepeat, ...speakingSlots.interview])
      const calculatedTimeLimitMins = totalSecs > 0 ? Math.ceil(totalSecs / 60) : null

      const { data: exam, error: examErr } = await supabase
        .from('exams')
        .insert({
          teacher_id: user.id,
          class_id: classId || null,
          title: examTitle,
          description: JSON.stringify(adaptiveConfig),
          time_limit: calculatedTimeLimitMins,
          status: 'draft',
          show_result_immediately: true,
        })
        .select()
        .single()

      if (examErr || !exam) { setError(examErr?.message ?? '저장 실패'); return }

      const eqRows = m1Questions.map((q, i) => ({
        exam_id: exam.id, question_id: q.id, order_num: i + 1, points: 1,
      }))
      if (eqRows.length > 0) {
        const { error: eqErr } = await supabase.from('exam_questions').insert(eqRows)
        if (eqErr) { setError(eqErr.message); return }
      }

      router.push('/teacher/exams')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // ── 분석 사이드바 계산 ──────────────────────────────
  const allFilled = [
    ...m1.fillBlank, ...(m1.dailyLife ?? []), ...m1.deep,
    ...m2up.fillBlank, ...m2up.deep,
    ...m2down.fillBlank, ...m2down.deep,
  ]
  const filledCount = allFilled.filter(Boolean).length

  const m1FilledCount  = [...m1.fillBlank, ...(m1.dailyLife ?? []), ...m1.deep].filter(Boolean).length
  const m2upFilledCount  = [...m2up.fillBlank, ...m2up.deep].filter(Boolean).length
  const m2downFilledCount = [...m2down.fillBlank, ...m2down.deep].filter(Boolean).length

  // 예상 소요 시간 (채워진 슬롯의 DEFAULT_TIME_LIMITS 합산)
  const totalEstimatedSeconds = allFilled.filter(Boolean).reduce((sum, q) => {
    return sum + (DEFAULT_TIME_LIMITS[q!.question_subtype ?? ''] ?? 30)
  }, 0)

  // ── 공통: SlotGroup props 빌더 ────────────────────
  const slotGroupProps = (
    module: 'M1'|'M2up'|'M2down',
    slotType: 'fillBlank'|'dailyLife'|'deep',
  ) => {
    const current = module === 'M1' ? m1 : module === 'M2up' ? m2up : m2down
    const range = SLOT_RANGE[slotType] ?? { min: 3, max: 20 }
    const count = (current[slotType] ?? []).length
    return {
      slots: (current[slotType] ?? []) as (SlotQ | null)[],
      filling: filling === `${module}_${slotType}`,
      allSlotIds: allIds,
      targetBand, maxBand,
      module,
      slotType,
      onFill: () => magicFill(module, slotType),
      onSwapOpen: (idx: number, q: SlotQ) => openSwap(module, slotType, idx, q),
      onRemove: (idx: number) => removeSlot(module, slotType, idx),
      onResize: (delta: 1 | -1) => resizeReadingSlot(module, slotType, delta),
      onPickOpen: (idx: number) => setPickerState({ module, slotType, idx }),
    }
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── 상단 헤더 ── */}
      <div className="flex items-center justify-between px-3 md:px-6 py-2 md:py-3 border-b border-gray-100 bg-white flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Zap size={16} className="text-blue-600 flex-shrink-0" />
          <input
            value={examTitle}
            onChange={e => setExamTitle(e.target.value)}
            placeholder="시험 제목..."
            className="text-sm md:text-lg font-bold text-gray-900 bg-transparent border-none outline-none flex-1 min-w-0 placeholder-gray-300"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {error && <span className="text-xs text-red-500 hidden md:inline">{error}</span>}
          <button onClick={() => router.back()}
            className="px-2.5 py-1.5 md:px-3 border border-gray-200 rounded-lg text-xs md:text-sm text-gray-600 hover:bg-gray-50 transition">
            취소
          </button>
          <button onClick={saveExam} disabled={saving}
            className="inline-flex items-center gap-1 md:gap-1.5 px-2.5 py-1.5 md:px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-xs md:text-sm font-bold transition">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            저장
          </button>
        </div>
      </div>

      {/* ── 설정 바 ── */}
      <div className="bg-gray-50 border-b border-gray-100 flex-shrink-0">
        {/* 항상 보이는 첫 행: 클래스 + 시험 성격 + 아코디언 토글(모바일) */}
        <div className="flex items-center gap-2 px-3 md:px-6 py-2 flex-wrap">
          {/* 클래스 */}
          <select value={classId} onChange={e => setClassId(e.target.value)}
            className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[130px] md:max-w-none">
            <option value="">전체 (이력 미적용)</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {/* 시험 성격 */}
          <div className="flex items-center gap-1">
            {TEST_TYPES.map(t => (
              <button key={t.v} onClick={() => setTestType(t.v)}
                title={t.desc}
                className={`px-2 py-1.5 rounded-lg text-xs font-bold transition ${
                  testType === t.v ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
                }`}>
                <span className="hidden md:inline">{t.label}</span>
                <span className="md:hidden">{t.v === 'weekly' ? '주간' : t.v === 'monthly' ? '월말' : '모의'}</span>
              </button>
            ))}
          </div>

          {/* 모바일: Target/Max Band 요약 + 토글 */}
          <button
            className="md:hidden ml-auto flex items-center gap-1 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg px-2 py-1.5 font-semibold"
            onClick={() => setSettingsOpen(o => !o)}
          >
            <span>T: {getDiffInfo(targetBand).label}</span>
            <span className="text-gray-300">|</span>
            <span>Max: {getDiffInfo(maxBand).label}</span>
            <ChevronDown size={12} className={`ml-1 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* 데스크탑: Target Band */}
          <div className="hidden md:flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">목표 Band (T)</label>
            <div className="flex gap-0.5">
              {DIFF_VALUES.map(v => {
                const info = getDiffInfo(v)
                return (
                  <button key={v} onClick={() => setTargetBand(v)}
                    title={`${info.level} · ${info.name} (${info.cefr})`}
                    className={`w-9 h-7 rounded text-[11px] font-bold transition ${
                      targetBand === v
                        ? `${info.color} ring-2 ring-blue-400`
                        : 'bg-white border border-gray-200 text-gray-500 hover:border-blue-300'
                    }`}>
                    {info.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 데스크탑: Max Band */}
          <div className="hidden md:flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Max Band</label>
            <div className="flex gap-0.5">
              {DIFF_VALUES.map(v => {
                const info = getDiffInfo(v)
                return (
                  <button key={v} onClick={() => setMaxBand(v)}
                    disabled={v < targetBand}
                    title={`${info.level} · ${info.name}`}
                    className={`w-9 h-7 rounded text-[11px] font-bold transition ${
                      maxBand === v
                        ? 'bg-orange-500 text-white ring-2 ring-orange-300'
                        : v < targetBand
                        ? 'bg-gray-50 border border-gray-100 text-gray-300 cursor-not-allowed'
                        : 'bg-white border border-gray-200 text-gray-500 hover:border-orange-300'
                    }`}>
                    {info.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 데스크탑: 창 안내 */}
          <div className="hidden md:flex ml-auto items-center gap-1.5 text-xs text-gray-400">
            <Info size={12} />
            <span>
              M1: {snapBand(targetBand-0.5)}~{snapBand(targetBand+0.5)} |
              M2↑: {snapBand(targetBand+0.5)}~{snapBand(targetBand+1.0)} |
              M2↓: {snapBand(targetBand-1.0)}~{snapBand(targetBand-0.5)}
            </span>
          </div>
        </div>

        {/* 모바일 아코디언: Band 슬라이더 */}
        {settingsOpen && (
          <div className="md:hidden px-3 pb-3 space-y-3 border-t border-gray-100 pt-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-500">목표 Band (T)</label>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getDiffInfo(targetBand).color}`}>
                  {getDiffInfo(targetBand).level} · {getDiffInfo(targetBand).label}
                </span>
              </div>
              <input type="range" min="1" max="6" step="0.5" value={targetBand}
                onChange={e => setTargetBand(Number(e.target.value))}
                className="w-full accent-blue-600" />
              <div className="flex justify-between text-[10px] text-gray-400 mt-0.5 px-0.5">
                <span>L1 · 1.0</span><span>MAX · 6.0</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-500">Max Band</label>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                  {getDiffInfo(maxBand).level} · {getDiffInfo(maxBand).label}
                </span>
              </div>
              <input type="range" min={targetBand} max="6" step="0.5" value={maxBand}
                onChange={e => setMaxBand(Number(e.target.value))}
                className="w-full accent-orange-500" />
              <div className="flex justify-between text-[10px] text-gray-400 mt-0.5 px-0.5">
                <span>T+0 · {targetBand}</span><span>MAX · 6.0</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <Info size={10} />
              <span>
                M1: {snapBand(targetBand-0.5)}~{snapBand(targetBand+0.5)} |
                M2↑: {snapBand(targetBand+0.5)}~{snapBand(targetBand+1.0)} |
                M2↓: {snapBand(targetBand-1.0)}~{snapBand(targetBand-0.5)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── 실시간 분석 (가로) ── */}
      {(activeTab === 'reading') && (
        <div className="flex items-center gap-4 px-6 py-2 bg-blue-50/60 border-b border-blue-100 flex-shrink-0 flex-wrap text-xs">
          <span className="font-extrabold text-blue-700 text-[11px]">실시간 분석</span>

          {/* 채움 현황 */}
          <div className="flex items-center gap-2.5">
            {[
              { label: 'M1',   filled: m1FilledCount,   total: m1.fillBlank.length + (m1.dailyLife?.length ?? 0) + m1.deep.length,   color: 'text-gray-700' },
              { label: 'M2↑',  filled: m2upFilledCount,  total: m2up.fillBlank.length + m2up.deep.length,   color: 'text-blue-600' },
              { label: 'M2↓',  filled: m2downFilledCount, total: m2down.fillBlank.length + m2down.deep.length, color: 'text-amber-600' },
            ].map(r => (
              <div key={r.label} className="flex items-center gap-1">
                <span className={`font-bold ${r.color}`}>{r.label}</span>
                <span className="text-gray-500">{r.filled}/{r.total}</span>
                {r.filled === r.total
                  ? <CheckCircle2 size={11} className="text-green-500" />
                  : <AlertCircle size={11} className="text-gray-300" />}
              </div>
            ))}
          </div>

          <div className="h-3 w-px bg-blue-200" />

          {/* 예상 소요 시간 */}
          <div className="flex items-center gap-1">
            <Clock size={11} className="text-blue-400" />
            <span className="text-gray-500">예상 시간:</span>
            <span className="font-bold text-gray-700">
              {totalEstimatedSeconds > 0 ? formatSeconds(totalEstimatedSeconds) : '—'}
            </span>
          </div>

          {filledCount > 0 && (
            <>
              <div className="h-3 w-px bg-blue-200" />

              {/* 균형 체크 */}
              {(() => {
                const overMax = allFilled.filter(Boolean).some(q => q!.difficulty > maxBand)
                const m2upAvg = m2up.fillBlank.concat(m2up.deep).filter(Boolean)
                  .reduce((s, q) => s + q!.difficulty, 0) / Math.max(1, m2upFilledCount)
                const m2downAvg = m2down.fillBlank.concat(m2down.deep).filter(Boolean)
                  .reduce((s, q) => s + q!.difficulty, 0) / Math.max(1, m2downFilledCount)
                const spread = m2upAvg - m2downAvg
                const idx = m2upFilledCount > 0 && m2downFilledCount > 0
                  ? Math.round(Math.min(100, ((m2upAvg - m2downAvg) / 4) * 100))
                  : null

                return (
                  <div className="flex items-center gap-3">
                    {overMax
                      ? <span className="flex items-center gap-1 text-amber-600 font-semibold"><AlertCircle size={11} /> Max Band 초과</span>
                      : <span className="flex items-center gap-1 text-green-600 font-semibold"><CheckCircle2 size={11} /> Max Band 내</span>
                    }
                    {idx !== null && (
                      <span className="text-gray-500">
                        변별력: <strong className={idx >= 50 ? 'text-blue-600' : 'text-amber-500'}>{idx}%</strong>
                        <span className="ml-1 text-gray-400">{idx >= 75 ? '우수' : idx >= 50 ? '양호' : '부족'}</span>
                      </span>
                    )}
                    {spread >= 0 && m2upFilledCount > 0 && m2downFilledCount > 0 && (
                      <span className={`font-semibold ${spread >= 1.5 ? 'text-green-600' : 'text-amber-500'}`}>
                        {spread < 1 ? '상/하 난이도 차이 작음' : spread >= 2 ? '변별력 우수 ✓' : '적절한 구분 ✓'}
                      </span>
                    )}
                  </div>
                )
              })()}
            </>
          )}
        </div>
      )}

      {/* ── 섹션 탭 ── */}
      <div className="flex items-center gap-1 px-3 md:px-6 py-2 border-b border-gray-100 bg-white flex-shrink-0 flex-wrap">
        {([
          { key: 'reading',   label: 'Reading',   short: 'R', icon: <FileText size={13} />,   active: 'bg-blue-600',    total: 50,  filled: filledCount },
          { key: 'listening', label: 'Listening', short: 'L', icon: <Headphones size={13} />, active: 'bg-emerald-600', total: null, filled: null },
          { key: 'writing',   label: 'Writing',   short: 'W', icon: <PenLine size={13} />,    active: 'bg-purple-600',  total: writingSlots.reordering.length + writingSlots.email.length, filled: [...writingSlots.reordering, ...writingSlots.email].filter(Boolean).length },
          { key: 'speaking',  label: 'Speaking',  short: 'S', icon: <Mic size={13} />,        active: 'bg-teal-600',    total: speakingSlots.listenRepeat.length + speakingSlots.interview.length, filled: [...speakingSlots.listenRepeat, ...speakingSlots.interview].filter(Boolean).length },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`inline-flex items-center gap-1 md:gap-1.5 px-2.5 md:px-4 py-1.5 md:py-2 rounded-xl text-xs md:text-sm font-bold transition ${
              activeTab === tab.key ? `${tab.active} text-white` : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            {tab.icon}
            <span className="md:hidden">{tab.short}</span>
            <span className="hidden md:inline">{tab.label}</span>
            {tab.total !== null && (
              <span className={`text-[10px] ml-0.5 ${activeTab === tab.key ? 'text-white/70' : 'text-gray-400'}`}>
                {tab.filled}/{tab.total}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── 메인 컨텐츠 ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* 3열 캔버스 */}
        <div className={`flex-1 overflow-x-auto overflow-y-auto ${activeTab !== 'reading' ? 'hidden' : ''}`}>
          {/* 모바일 모듈 탭 */}
          <div className="md:hidden flex items-center gap-1 px-3 pt-3 pb-0">
            {([
              { key: 'M1',     label: 'M1',   color: 'bg-gray-800 text-white', inactive: 'bg-gray-100 text-gray-500' },
              { key: 'M2up',   label: 'M2↑',  color: 'bg-blue-600 text-white', inactive: 'bg-blue-50 text-blue-500' },
              { key: 'M2down', label: 'M2↓',  color: 'bg-amber-500 text-white', inactive: 'bg-amber-50 text-amber-500' },
            ] as const).map(m => (
              <button key={m.key} onClick={() => setActiveModule(m.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex-1 ${activeModule === m.key ? m.color : m.inactive}`}>
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex gap-3 p-3 md:p-4 md:min-w-[900px] h-full items-start">

            {/* ── Module 1 ── */}
            <div className={`flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${activeModule !== 'M1' ? 'hidden md:block' : ''}`}>
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-gray-900 text-sm">Module 1</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">공통 모듈 — 모든 학생</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-bold text-gray-700">
                      {m1FilledCount}/{m1.fillBlank.length + (m1.dailyLife?.length ?? 0) + m1.deep.length} 채움
                    </span>
                    <button
                      disabled={!!filling}
                      onClick={async () => {
                        await magicFill('M1', 'fillBlank')
                        await magicFill('M1', 'dailyLife')
                        await magicFill('M1', 'deep')
                      }}
                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white rounded-lg transition">
                      {filling?.startsWith('M1') ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
                      All
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-3">
                <SlotGroup label="Fill in the Blank" icon={<AlignLeft size={12} />}
                  {...slotGroupProps('M1', 'fillBlank')} />
                <SlotGroup label="Daily Life" icon={<Globe size={12} />}
                  {...slotGroupProps('M1', 'dailyLife')} />
                <SlotGroup label="Academic Passage" icon={<BookOpen size={12} />}
                  {...slotGroupProps('M1', 'deep')} />
              </div>
            </div>

            {/* ── Module 2-Up ── */}
            <div className={`flex-1 bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden ${activeModule !== 'M2up' ? 'hidden md:block' : ''}`}>
              <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <ArrowUp size={14} className="text-blue-600" />
                      <h3 className="font-extrabold text-blue-900 text-sm">Module 2-Up</h3>
                    </div>
                    <p className="text-[11px] text-blue-400 mt-0.5">M1 점수 70% 이상 → 진입</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-bold text-blue-700">
                      {m2upFilledCount}/{m2up.fillBlank.length + m2up.deep.length} 채움
                    </span>
                    <button
                      disabled={!!filling}
                      onClick={async () => {
                        await magicFill('M2up', 'fillBlank')
                        await magicFill('M2up', 'deep')
                      }}
                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition">
                      {filling?.startsWith('M2up') ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
                      All
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-3">
                <SlotGroup label="Fill in the Blank (Advanced)" icon={<AlignLeft size={12} />}
                  {...slotGroupProps('M2up', 'fillBlank')} />
                <SlotGroup label="Academic Passage (Advanced)" icon={<BookOpen size={12} />}
                  {...slotGroupProps('M2up', 'deep')} />
              </div>
            </div>

            {/* ── Module 2-Down ── */}
            <div className={`flex-1 bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden ${activeModule !== 'M2down' ? 'hidden md:block' : ''}`}>
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <ArrowDown size={14} className="text-amber-600" />
                      <h3 className="font-extrabold text-amber-900 text-sm">Module 2-Down</h3>
                    </div>
                    <p className="text-[11px] text-amber-400 mt-0.5">M1 점수 70% 미만 → 진입</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-bold text-amber-700">
                      {m2downFilledCount}/{m2down.fillBlank.length + m2down.deep.length} 채움
                    </span>
                    <button
                      disabled={!!filling}
                      onClick={async () => {
                        await magicFill('M2down', 'fillBlank')
                        await magicFill('M2down', 'deep')
                      }}
                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded-lg transition">
                      {filling?.startsWith('M2down') ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
                      All
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-3">
                <SlotGroup label="Fill in the Blank (Remedial)" icon={<AlignLeft size={12} />}
                  {...slotGroupProps('M2down', 'fillBlank')} />
                <SlotGroup label="Academic Passage (Remedial)" icon={<BookOpen size={12} />}
                  {...slotGroupProps('M2down', 'deep')} />
              </div>
            </div>

          </div>
        </div>

        {/* ── Listening 캔버스 ── */}
        {activeTab === 'listening' && (
          <div className="flex-1 overflow-x-auto overflow-y-auto">
            <ListeningCanvas
              lm1={lm1} setLM1={setLM1}
              lm2up={lm2up} setLM2Up={setLM2Up}
              lm2down={lm2down} setLM2Down={setLM2Down}
              classId={classId}
              targetBand={targetBand}
              maxBand={maxBand}
              filling={filling}
              setFilling={setFilling}
              allIds={allIds}
            />
          </div>
        )}

        {/* ── Writing 캔버스 ── */}
        {activeTab === 'writing' && (
          <WritingCanvas
            slots={writingSlots}
            setSlots={setWritingSlots}
            classId={classId}
            targetBand={targetBand}
            maxBand={maxBand}
            filling={filling}
            setFilling={setFilling}
            allIds={allIds}
          />
        )}

        {/* ── Speaking 캔버스 ── */}
        {activeTab === 'speaking' && (
          <SpeakingCanvas
            slots={speakingSlots}
            setSlots={setSpeakingSlots}
            classId={classId}
            targetBand={targetBand}
            maxBand={maxBand}
            filling={filling}
            setFilling={setFilling}
            allIds={allIds}
          />
        )}

      </div>

      {/* ── Smart Swap 팝업 ── */}
      {swapState && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-extrabold text-gray-900">Smart Swap</h3>
                <p className="text-xs text-gray-500 mt-0.5">동일 유형 · 유사 난이도 후보 문제</p>
              </div>
              <button onClick={() => setSwapState(null)} className="text-gray-400 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>

            {/* 현재 문제 */}
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 mb-1">현재 문제</p>
              <div className="flex items-start gap-2">
                <BandBadge d={swapState.q.difficulty} />
                <p className="text-xs text-gray-600 line-clamp-2">{swapState.q.content}</p>
              </div>
            </div>

            {/* 후보 목록 */}
            <div className="px-5 py-3 space-y-2 max-h-72 overflow-y-auto">
              {swapState.candidates.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">교체 가능한 문제가 없습니다.</p>
              ) : swapState.candidates.map(c => (
                <button key={c.id} onClick={() => applySwap(c)}
                  className="w-full flex items-start gap-2.5 p-3 rounded-xl border border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition text-left">
                  <BandBadge d={c.difficulty} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 line-clamp-2">{c.content}</p>
                    {c.question_subtype && (
                      <p className="text-[10px] text-gray-400 mt-0.5">{c.question_subtype.replace(/_/g, ' ')}</p>
                    )}
                  </div>
                  <ChevronRight size={14} className="text-gray-300 flex-shrink-0 mt-0.5" />
                </button>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-gray-100">
              <button onClick={() => setSwapState(null)}
                className="w-full py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition">
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      <QuestionPickerModal
        open={!!pickerState}
        onClose={() => setPickerState(null)}
        onSelect={handlePickSelect}
        onSelectSet={
          pickerState && (pickerState.slotType === 'deep' || pickerState.slotType === 'dailyLife')
            ? handlePickSelectSet
            : undefined
        }
        onSelectMultiple={handlePickSelectSet}
        multiSelect
        category="reading"
        allowedSubtypes={pickerState ? READING_SUBTYPES[pickerState.slotType] : undefined}
        excludeIds={allIds}
        title="Reading 문제 직접 선택"
      />
    </div>
  )
}
