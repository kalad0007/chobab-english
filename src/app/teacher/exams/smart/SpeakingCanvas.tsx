'use client'

import { useState, Dispatch, SetStateAction } from 'react'
import { Zap, X, Loader2, Mic, MessageSquare, Minus, Plus, Volume2, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import { DEFAULT_TIME_LIMITS, formatSeconds } from '@/lib/utils'
import QuestionPickerModal, { type PickedQuestion } from './QuestionPickerModal'

// ─── 타입 ──────────────────────────────────────────────
export interface SpeakingSlotQ {
  id: string
  content: string
  difficulty: number
  question_subtype: string | null
  audio_url: string | null
  type: string
}

export interface SpeakingSlots {
  listenRepeat: (SpeakingSlotQ | null)[]   // 기본 7개, ±2
  interview:    (SpeakingSlotQ | null)[]   // 기본 5개, ±1 (4~6)
}

export function emptySpeakingSlots(): SpeakingSlots {
  return {
    listenRepeat: Array(7).fill(null),
    interview:    Array(5).fill(null),
  }
}

// 슬롯 범위 상수
const LR_MIN = 5, LR_MAX = 9, LR_DEFAULT = 7
const IV_MIN = 4, IV_MAX = 6, IV_DEFAULT = 5

const SPEAKING_SUBTYPES: Record<string, string[]> = {
  listenRepeat: ['listen_and_repeat'],
  interview:    ['take_an_interview'],
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
function SpeakingSlotCard({
  idx, q, onRemove, showAudio, onPickOpen,
}: {
  idx: number
  q: SpeakingSlotQ | null
  onRemove: () => void
  showAudio?: boolean
  onPickOpen?: () => void
}) {
  if (!q) {
    return (
      <button
        onClick={onPickOpen}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-gray-200 text-xs text-gray-300 bg-gray-50 hover:border-teal-300 hover:text-teal-400 hover:bg-teal-50 transition">
        <span className="w-6 text-center font-bold">{idx + 1}</span>
        <span>빈 슬롯 — 클릭하여 직접 선택</span>
      </button>
    )
  }
  return (
    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-gray-100 bg-white hover:border-teal-200 transition group">
      <span className="w-6 text-center text-xs font-bold text-gray-400 mt-0.5 flex-shrink-0">{idx + 1}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-700 line-clamp-2 leading-snug">{q.content}</p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <BandBadge d={q.difficulty} />
          {showAudio && q.audio_url && (
            <button
              onClick={() => new Audio(q.audio_url!).play()}
              className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-teal-50 text-teal-600 rounded-full hover:bg-teal-100 transition">
              <Volume2 size={9} /> 듣기
            </button>
          )}
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

// ─── 슬롯 그룹 컴포넌트 ─────────────────────────────────
function SpeakingGroup({
  label, icon, iconColor, description, slots, filling, onFill, onRemove, onResize,
  minCount, maxCount, showAudio, accentClass, onPickOpen,
}: {
  label: string
  icon: React.ReactNode
  iconColor: string
  description?: string
  slots: (SpeakingSlotQ | null)[]
  filling: boolean
  onFill: () => void
  onRemove: (idx: number) => void
  onResize: (delta: 1 | -1) => void
  minCount: number
  maxCount: number
  showAudio?: boolean
  accentClass?: string
  onPickOpen: (idx: number) => void
}) {
  const filled = slots.filter(Boolean).length
  const count = slots.length
  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${accentClass ?? 'border-gray-100'}`}>
      <div className={`px-4 py-3 border-b flex items-center justify-between ${
        accentClass === 'border-teal-100' ? 'bg-teal-50 border-teal-100' :
        accentClass === 'border-cyan-100'  ? 'bg-cyan-50  border-cyan-100'  :
        'bg-gray-50 border-gray-100'
      }`}>
        <div className="flex items-center gap-2">
          <span className={iconColor}>{icon}</span>
          <div>
            <h4 className="text-sm font-extrabold text-gray-900">{label}</h4>
            {description && <p className="text-[11px] text-gray-400 mt-0.5">{description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 슬롯 수 조절 */}
          <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 px-1.5 py-0.5">
            <button onClick={() => onResize(-1)} disabled={count <= minCount}
              className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition">
              <Minus size={11} />
            </button>
            <span className="text-xs font-bold text-gray-700 w-4 text-center">{count}</span>
            <button onClick={() => onResize(1)} disabled={count >= maxCount}
              className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition">
              <Plus size={11} />
            </button>
          </div>
          <span className="text-xs font-bold text-gray-500">{filled}/{count}</span>
          <button onClick={onFill} disabled={filling} title="Magic Fill"
            className="inline-flex items-center justify-center w-7 h-7 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white rounded-lg transition">
            {filling ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
          </button>
        </div>
      </div>
      <div className="p-3 space-y-1.5">
        {slots.map((q, i) => (
          <SpeakingSlotCard
            key={i}
            idx={i}
            q={q}
            onRemove={() => onRemove(i)}
            showAudio={showAudio}
            onPickOpen={() => onPickOpen(i)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── 메인 컴포넌트 ──────────────────────────────────────
interface Props {
  slots: SpeakingSlots
  setSlots: Dispatch<SetStateAction<SpeakingSlots>>
  classId: string
  targetBand: number
  maxBand: number
  filling: string | null
  setFilling: Dispatch<SetStateAction<string | null>>
  allIds: string[]
}

export default function SpeakingCanvas({
  slots, setSlots, classId, targetBand, maxBand,
  filling, setFilling, allIds,
}: Props) {
  const [error, setError] = useState('')
  const [pickerState, setPickerState] = useState<{
    slotType: 'listenRepeat' | 'interview'
    idx: number
  } | null>(null)

  function toSlotQ(q: PickedQuestion): SpeakingSlotQ {
    return { id: q.id, content: q.content, difficulty: q.difficulty, question_subtype: q.question_subtype, audio_url: q.audio_url ?? null, type: q.type }
  }

  function handlePickSelect(picked: PickedQuestion) {
    if (!pickerState) return
    const { slotType, idx } = pickerState
    setSlots(prev => {
      const arr = [...prev[slotType]] as (SpeakingSlotQ | null)[]
      arr[idx] = toSlotQ(picked)
      return { ...prev, [slotType]: arr }
    })
    setPickerState(null)
  }

  // 다중 선택 or 세트 선택 → 클릭한 슬롯부터 연속으로 채우기 (상한값 내 자동 확장)
  function handlePickMultiple(qs: PickedQuestion[]) {
    if (!pickerState || qs.length === 0) return
    const { slotType, idx } = pickerState
    const maxCount = slotType === 'listenRepeat' ? LR_MAX : IV_MAX
    setSlots(prev => {
      const arr = [...prev[slotType]] as (SpeakingSlotQ | null)[]
      const needed = idx + qs.length
      while (arr.length < needed && arr.length < maxCount) arr.push(null)
      qs.forEach((q, i) => { if (idx + i < arr.length) arr[idx + i] = toSlotQ(q) })
      return { ...prev, [slotType]: arr }
    })
    setPickerState(null)
  }

  const totalSlots  = slots.listenRepeat.length + slots.interview.length
  const filledCount = [...slots.listenRepeat, ...slots.interview].filter(Boolean).length

  async function magicFill(slotType: 'listen_and_repeat' | 'interview') {
    const key = `speaking_${slotType}`
    setFilling(key)
    setError('')

    try {
      const arr = slotType === 'listen_and_repeat' ? slots.listenRepeat : slots.interview
      const emptyCount = arr.filter(s => !s).length
      if (emptyCount === 0) return

      const res = await fetch('/api/teacher/speaking-fill', {
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

      const newQs: SpeakingSlotQ[] = data.questions
      let qi = 0
      const updated = arr.map(s => s ?? (newQs[qi++] ?? null))

      if (slotType === 'listen_and_repeat') {
        setSlots(prev => ({ ...prev, listenRepeat: updated }))
      } else {
        setSlots(prev => ({ ...prev, interview: updated }))
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setFilling(null)  // ← 어떤 경우에도 반드시 해제
    }
  }

  function removeSlot(section: 'listenRepeat' | 'interview', idx: number) {
    setSlots(prev => {
      const arr = [...prev[section]] as (SpeakingSlotQ | null)[]
      arr[idx] = null
      return { ...prev, [section]: arr }
    })
  }

  function resizeSlots(section: 'listenRepeat' | 'interview', delta: 1 | -1) {
    setSlots(prev => {
      const arr = [...prev[section]]
      if (delta === 1) {
        arr.push(null)
      } else if (arr.length > 1) {
        // 마지막 채워진 슬롯 이후 빈 슬롯 제거 or 마지막 제거
        const lastNullIdx = [...arr].map((q, i) => ({ q, i })).reverse().find(x => !x.q)?.i
        if (lastNullIdx !== undefined) arr.splice(lastNullIdx, 1)
        else arr.pop()
      }
      return { ...prev, [section]: arr }
    })
  }

  const sLRSec = slots.listenRepeat.filter(Boolean).length * (DEFAULT_TIME_LIMITS['listen_and_repeat'] ?? 10)
  const sIVSec = slots.interview.filter(Boolean).length * (DEFAULT_TIME_LIMITS['take_an_interview'] ?? 45)
  const sTotalSec = sLRSec + sIVSec

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* ── 실시간 분석 (가로) ── */}
      <div className="flex items-center gap-4 px-6 py-2 bg-teal-50/60 border-b border-teal-100 flex-shrink-0 flex-wrap text-xs">
        <span className="font-extrabold text-teal-700 text-[11px]">실시간 분석</span>
        <div className="flex items-center gap-2.5">
          {[
            { label: '듣고 따라말하기', filled: slots.listenRepeat.filter(Boolean).length, total: slots.listenRepeat.length, color: 'text-teal-600' },
            { label: '인터뷰',         filled: slots.interview.filter(Boolean).length,    total: slots.interview.length,    color: 'text-cyan-600' },
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
        <div className="h-3 w-px bg-teal-200" />
        <div className="flex items-center gap-1">
          <Clock size={11} className="text-teal-400" />
          <span className="text-gray-500">예상 시간:</span>
          <span className="font-bold text-gray-700">{sTotalSec > 0 ? formatSeconds(sTotalSec) : '—'}</span>
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

          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-gray-900">Speaking 구성</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                단일 경로 — 듣고 따라말하기 {slots.listenRepeat.length}문항 + 인터뷰 {slots.interview.length}문항
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{filledCount}/{totalSlots}</span>
              <button
                onClick={async () => {
                  await magicFill('listen_and_repeat')
                  await magicFill('interview')
                }}
                disabled={!!filling}
                className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5
                  bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white rounded-lg transition">
                <Zap size={12} /> All
              </button>
            </div>
          </div>

          {/* ① 듣고 따라말하기 */}
          <SpeakingGroup
            label="듣고 따라말하기 (Listen & Repeat)"
            icon={<Mic size={14} />}
            iconColor="text-teal-600"
            description={`${LR_MIN}~${LR_MAX}문항 조절 가능 · STT 자동 채점`}
            slots={slots.listenRepeat}
            filling={filling === 'speaking_listen_and_repeat'}
            onFill={() => magicFill('listen_and_repeat')}
            onRemove={i => removeSlot('listenRepeat', i)}
            onResize={d => resizeSlots('listenRepeat', d)}
            minCount={LR_MIN}
            maxCount={LR_MAX}
            showAudio
            accentClass="border-teal-100"
            onPickOpen={i => setPickerState({ slotType: 'listenRepeat', idx: i })}
          />

          {/* ② 인터뷰 */}
          <SpeakingGroup
            label="인터뷰 (Take an Interview)"
            icon={<MessageSquare size={14} />}
            iconColor="text-cyan-600"
            description={`${IV_MIN}~${IV_MAX}문항 조절 가능 · AI Band 채점`}
            slots={slots.interview}
            filling={filling === 'speaking_interview'}
            onFill={() => magicFill('interview')}
            onRemove={i => removeSlot('interview', i)}
            onResize={d => resizeSlots('interview', d)}
            minCount={IV_MIN}
            maxCount={IV_MAX}
            accentClass="border-cyan-100"
            onPickOpen={i => setPickerState({ slotType: 'interview', idx: i })}
          />

        </div>
      </div>

      <QuestionPickerModal
        open={!!pickerState}
        onClose={() => setPickerState(null)}
        onSelect={handlePickSelect}
        onSelectSet={pickerState?.slotType === 'interview' ? handlePickMultiple : undefined}
        onSelectMultiple={handlePickMultiple}
        multiSelect
        category="speaking"
        allowedSubtypes={pickerState ? SPEAKING_SUBTYPES[pickerState.slotType] : undefined}
        excludeIds={allIds}
        title={pickerState?.slotType === 'interview' ? 'Interview 문제 선택' : 'Listen & Repeat 문제 선택'}
      />
    </div>
  )
}
