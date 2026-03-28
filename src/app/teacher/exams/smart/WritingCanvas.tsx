'use client'

import { useState, Dispatch, SetStateAction } from 'react'
import { Zap, X, Loader2, AlignLeft, Mail, MessageSquare, Plus, Minus, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import { DEFAULT_TIME_LIMITS, formatSeconds } from '@/lib/utils'
import QuestionPickerModal, { type PickedQuestion } from './QuestionPickerModal'

// Writing 슬롯 범위 (±2)
const W_RANGE = {
  reordering:  { min: 8, max: 12 },
  email:       { min: 1, max: 4  },
  discussion:  { min: 1, max: 4  },
} as const

const WRITING_SUBTYPES: Record<string, string[]> = {
  reordering:  ['sentence_reordering'],
  email:       ['email_writing'],
  discussion:  ['academic_discussion'],
}

// ─── 타입 ──────────────────────────────────────────────
export interface WritingSlotQ {
  id: string
  content: string
  difficulty: number
  question_subtype: string | null
  type: string
}

export interface WritingSlots {
  reordering:  (WritingSlotQ | null)[]   // 10개
  email:       (WritingSlotQ | null)[]   // 2개
  discussion:  (WritingSlotQ | null)[]   // 2개
}

export function emptyWritingSlots(): WritingSlots {
  return {
    reordering:  Array(10).fill(null),
    email:       Array(2).fill(null),
    discussion:  Array(2).fill(null),
  }
}

// ─── 난이도 배지 ────────────────────────────────────────
const BAND: Record<number, { band: string; color: string }> = {
  1: { band: '2.0', color: 'bg-gray-100 text-gray-600' },
  2: { band: '3.0', color: 'bg-green-100 text-green-700' },
  3: { band: '4.0', color: 'bg-blue-100 text-blue-700' },
  4: { band: '5.0', color: 'bg-purple-100 text-purple-700' },
  5: { band: '6.0', color: 'bg-orange-100 text-orange-700' },
}

function BandBadge({ d }: { d: number }) {
  const b = BAND[d] ?? BAND[3]
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${b.color}`}>
      Band {b.band}
    </span>
  )
}

// ─── 슬롯 카드 ──────────────────────────────────────────
function WritingSlotCard({
  idx, q, onRemove, label, onPickOpen,
}: {
  idx: number
  q: WritingSlotQ | null
  onRemove: () => void
  label?: string
  onPickOpen?: () => void
}) {
  if (!q) {
    return (
      <button
        onClick={onPickOpen}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-gray-200 text-xs text-gray-300 bg-gray-50 hover:border-purple-300 hover:text-purple-400 hover:bg-purple-50 transition">
        <span className="w-6 text-center font-bold text-gray-300">{label ?? idx + 1}</span>
        <span>빈 슬롯 — 클릭하여 직접 선택</span>
      </button>
    )
  }
  return (
    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-gray-100 bg-white hover:border-purple-200 transition group">
      <span className="w-6 text-center text-xs font-bold text-gray-400 mt-0.5 flex-shrink-0">{label ?? idx + 1}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-700 line-clamp-2 leading-snug">{q.content}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <BandBadge d={q.difficulty} />
          {q.question_subtype && (
            <span className="text-[10px] text-gray-400">{q.question_subtype.replace(/_/g, ' ')}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
        {onPickOpen && (
          <button onClick={onPickOpen}
            className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded hover:bg-purple-100 font-bold transition">
            직접 교체
          </button>
        )}
        <button onClick={onRemove}
          className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-500 rounded hover:bg-red-100 font-bold transition">
          제거
        </button>
      </div>
    </div>
  )
}

// ─── 슬롯 섹션 ──────────────────────────────────────────
function SlotSection({
  label, icon, iconColor, slots, filling, onFill, onRemove,
  description, accentClass, onResize, minCount, maxCount, onPickOpen,
}: {
  label: string
  icon: React.ReactNode
  iconColor: string
  slots: (WritingSlotQ | null)[]
  filling: boolean
  onFill: () => void
  onRemove: (idx: number) => void
  description?: string
  accentClass?: string
  onResize: (delta: 1 | -1) => void
  minCount: number
  maxCount: number
  onPickOpen: (idx: number) => void
}) {
  const filled = slots.filter(Boolean).length
  const bgClass = accentClass === 'border-indigo-100' ? 'bg-indigo-50 border-indigo-100'
    : accentClass === 'border-purple-100' ? 'bg-purple-50 border-purple-100'
    : 'bg-gray-50 border-gray-100'
  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${accentClass ?? 'border-gray-100'}`}>
      <div className={`px-4 py-3 border-b flex items-center justify-between ${bgClass}`}>
        <div className="flex items-center gap-2">
          <span className={iconColor}>{icon}</span>
          <div>
            <h4 className="text-sm font-extrabold text-gray-900">{label}</h4>
            {description && <p className="text-[11px] text-gray-400 mt-0.5">{description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* ±2 카운터 */}
          <div className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg px-1.5 py-0.5">
            <button onClick={() => onResize(-1)} disabled={slots.length <= minCount}
              className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-800 disabled:opacity-30 transition">
              <Minus size={9} />
            </button>
            <span className="text-[11px] font-bold text-gray-700 w-5 text-center">{slots.length}</span>
            <button onClick={() => onResize(1)} disabled={slots.length >= maxCount}
              className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-800 disabled:opacity-30 transition">
              <Plus size={9} />
            </button>
          </div>
          <span className="text-xs font-bold text-gray-500">{filled}개 채움</span>
          <button onClick={onFill} disabled={filling} title="Magic Fill"
            className="inline-flex items-center justify-center w-7 h-7 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-lg transition">
            {filling ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
          </button>
        </div>
      </div>
      <div className="p-3 space-y-1.5">
        {slots.map((q, i) => (
          <WritingSlotCard
            key={i}
            idx={i}
            q={q}
            label={undefined}
            onRemove={() => onRemove(i)}
            onPickOpen={() => onPickOpen(i)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── 메인 컴포넌트 ──────────────────────────────────────
interface Props {
  slots: WritingSlots
  setSlots: Dispatch<SetStateAction<WritingSlots>>
  classId: string
  targetBand: number
  maxBand: number
  filling: string | null
  setFilling: Dispatch<SetStateAction<string | null>>
  allIds: string[]
}

export default function WritingCanvas({
  slots, setSlots, classId, targetBand, maxBand,
  filling, setFilling, allIds,
}: Props) {
  const [error, setError] = useState('')
  const [pickerState, setPickerState] = useState<{
    slotType: 'reordering' | 'email' | 'discussion'
    idx: number
  } | null>(null)

  function handlePickSelect(picked: PickedQuestion) {
    if (!pickerState) return
    const { slotType, idx } = pickerState
    const q: WritingSlotQ = {
      id: picked.id,
      content: picked.content,
      difficulty: picked.difficulty,
      question_subtype: picked.question_subtype,
      type: picked.type,
    }
    setSlots(prev => {
      const arr = [...prev[slotType]] as (WritingSlotQ | null)[]
      arr[idx] = q
      return { ...prev, [slotType]: arr }
    })
    setPickerState(null)
  }

  const totalSlots  = slots.reordering.length + slots.email.length + slots.discussion.length
  const filledCount = [...slots.reordering, ...slots.email, ...slots.discussion].filter(Boolean).length

  async function magicFill(slotType: 'sentence_reordering' | 'email_writing' | 'academic_discussion') {
    const key = `writing_${slotType}`
    setFilling(key)
    setError('')

    try {
      const arr = slotType === 'sentence_reordering' ? slots.reordering
        : slotType === 'email_writing' ? slots.email
        : slots.discussion
      const emptyCount = arr.filter(s => !s).length
      if (emptyCount === 0) return

      const res = await fetch('/api/teacher/writing-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId, targetBand, maxBand,
          slotType, count: emptyCount,
          excludeIds: allIds,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? '오류 발생'); return }

      const newQs: WritingSlotQ[] = data.questions
      let qi = 0
      const updated = arr.map(s => s ?? (newQs[qi++] ?? null))

      if (slotType === 'sentence_reordering') {
        setSlots(prev => ({ ...prev, reordering: updated }))
      } else if (slotType === 'email_writing') {
        setSlots(prev => ({ ...prev, email: updated }))
      } else {
        setSlots(prev => ({ ...prev, discussion: updated }))
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setFilling(null)  // ← 어떤 경우에도 반드시 해제
    }
  }

  function removeSlot(slotType: 'reordering' | 'email' | 'discussion', idx: number) {
    setSlots(prev => {
      const arr = [...prev[slotType]] as (WritingSlotQ | null)[]
      arr[idx] = null
      return { ...prev, [slotType]: arr }
    })
  }

  function resizeWritingSlot(slotType: 'reordering' | 'email' | 'discussion', delta: 1 | -1) {
    setSlots(prev => {
      const arr = [...prev[slotType]] as (WritingSlotQ | null)[]
      if (delta === 1) {
        arr.push(null)
      } else {
        const lastNull = [...arr].map((q, i) => ({ q, i })).reverse().find(x => !x.q)?.i
        if (lastNull !== undefined) arr.splice(lastNull, 1)
        else arr.pop()
      }
      return { ...prev, [slotType]: arr }
    })
  }

  const wReorderingSec = slots.reordering.filter(Boolean).length * (DEFAULT_TIME_LIMITS['sentence_reordering'] ?? 35)
  const wEmailSec = slots.email.filter(Boolean).length * (DEFAULT_TIME_LIMITS['email_writing'] ?? 420)
  const wDiscussionSec = slots.discussion.filter(Boolean).length * (DEFAULT_TIME_LIMITS['academic_discussion'] ?? 600)
  const wTotalSec = wReorderingSec + wEmailSec + wDiscussionSec

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* ── 실시간 분석 (가로) ── */}
      <div className="flex items-center gap-4 px-6 py-2 bg-purple-50/60 border-b border-purple-100 flex-shrink-0 flex-wrap text-xs">
        <span className="font-extrabold text-purple-700 text-[11px]">실시간 분석</span>
        <div className="flex items-center gap-2.5">
          {[
            { label: '문장 배열', filled: slots.reordering.filter(Boolean).length, total: slots.reordering.length, color: 'text-indigo-600' },
            { label: '이메일',   filled: slots.email.filter(Boolean).length,       total: slots.email.length,       color: 'text-purple-600' },
            { label: '학술 토론', filled: slots.discussion.filter(Boolean).length, total: slots.discussion.length,  color: 'text-rose-600' },
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
        <div className="h-3 w-px bg-purple-200" />
        <div className="flex items-center gap-1">
          <Clock size={11} className="text-purple-400" />
          <span className="text-gray-500">예상 시간:</span>
          <span className="font-bold text-gray-700">{wTotalSec > 0 ? formatSeconds(wTotalSec) : '—'}</span>
        </div>
      </div>

      {/* ── 단일 컬럼 편집 영역 ── */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-2xl mx-auto space-y-4">

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
              <X size={14} />{error}
            </div>
          )}

          {/* 섹션 설명 헤더 */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-gray-900">Writing 구성</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                문장 배열 10문항 + 이메일 쓰기 2문항 + 학술 토론 2문항
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{filledCount}/{totalSlots}</span>
              <button
                onClick={async () => {
                  await magicFill('sentence_reordering')
                  await magicFill('email_writing')
                  await magicFill('academic_discussion')
                }}
                disabled={!!filling}
                className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5
                  bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white rounded-lg transition">
                <Zap size={12} /> All
              </button>
            </div>
          </div>

          {/* ① 문장 배열 */}
          <SlotSection
            label="문장 배열 (Sentence Reordering)"
            icon={<AlignLeft size={14} />}
            iconColor="text-indigo-500"
            slots={slots.reordering}
            filling={filling === 'writing_sentence_reordering'}
            onFill={() => magicFill('sentence_reordering')}
            onRemove={(i) => removeSlot('reordering', i)}
            description={`${slots.reordering.length}문항 · 쉬움→어려움 배열 · 자동 채점`}
            accentClass="border-indigo-100"
            onResize={d => resizeWritingSlot('reordering', d)}
            minCount={W_RANGE.reordering.min}
            maxCount={W_RANGE.reordering.max}
            onPickOpen={i => setPickerState({ slotType: 'reordering', idx: i })}
          />

          {/* ② 이메일 쓰기 */}
          <SlotSection
            label="이메일 쓰기 (Email Writing)"
            icon={<Mail size={14} />}
            iconColor="text-purple-500"
            slots={slots.email}
            filling={filling === 'writing_email_writing'}
            onFill={() => magicFill('email_writing')}
            onRemove={(i) => removeSlot('email', i)}
            description={`${slots.email.length}문항 · AI 채점 (Gemini)`}
            accentClass="border-purple-100"
            onResize={d => resizeWritingSlot('email', d)}
            minCount={W_RANGE.email.min}
            maxCount={W_RANGE.email.max}
            onPickOpen={i => setPickerState({ slotType: 'email', idx: i })}
          />

          {/* ③ 학술 토론 글쓰기 */}
          <SlotSection
            label="학술 토론 (Academic Discussion)"
            icon={<MessageSquare size={14} />}
            iconColor="text-rose-500"
            slots={slots.discussion}
            filling={filling === 'writing_academic_discussion'}
            onFill={() => magicFill('academic_discussion')}
            onRemove={(i) => removeSlot('discussion', i)}
            description={`${slots.discussion.length}문항 · AI 채점 (Gemini)`}
            accentClass="border-rose-100"
            onResize={d => resizeWritingSlot('discussion', d)}
            minCount={W_RANGE.discussion.min}
            maxCount={W_RANGE.discussion.max}
            onPickOpen={i => setPickerState({ slotType: 'discussion', idx: i })}
          />

        </div>
      </div>

      <QuestionPickerModal
        open={!!pickerState}
        onClose={() => setPickerState(null)}
        onSelect={handlePickSelect}
        category="writing"
        allowedSubtypes={pickerState ? WRITING_SUBTYPES[pickerState.slotType] : undefined}
        excludeIds={allIds}
        title="Writing 문제 직접 선택"
      />
    </div>
  )
}
