'use client'

import { useState } from 'react'
import { Volume2, Zap, Loader2, ArrowUp, ArrowDown, Plus, Minus, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import { getDiffInfo, DEFAULT_TIME_LIMITS, formatSeconds } from '@/lib/utils'
import QuestionPickerModal, { type PickedQuestion } from './QuestionPickerModal'

// 슬롯 수 범위 (모듈 x 타입)
const LISTEN_RANGE = {
  LM1:    { response: { min: 10, max: 14 }, conversation: { min: 2, max: 6 }, academicTalk: { min: 1, max: 5 } },
  LM2up:  { response: { min: 1,  max: 5  }, conversation: { min: 2, max: 6 }, academicTalk: { min: 1, max: 4 } },
  LM2down:{ response: { min: 1,  max: 5  }, conversation: { min: 2, max: 6 }, academicTalk: { min: 1, max: 4 } },
} as const

// ─── 공유 타입 ──────────────────────────────────────
export interface SlotQ {
  id: string
  content: string
  difficulty: number
  question_subtype: string | null
  audio_url?: string | null
  audio_id?: string | null
  type: string
}

export interface AudioSet {
  audioId: string
  audioUrl: string | null
  questions: SlotQ[]
}

export interface ListeningModSlots {
  response:     (SlotQ | null)[]
  conversation: (AudioSet | null)[]
  academicTalk: (AudioSet | null)[]
}

export const emptyListeningMod = (
  respCount: number, convCount: number, talkCount: number,
): ListeningModSlots => ({
  response:     Array(respCount).fill(null),
  conversation: Array(convCount).fill(null),
  academicTalk: Array(talkCount).fill(null),
})

// ─── Band 배지 (FLOAT 대응) ─────────────────────────
function BandBadge({ d }: { d: number }) {
  const info = getDiffInfo(d)
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${info.color}`}>
      {info.level}·{info.label}
    </span>
  )
}

// ─── Response 개별 카드 ─────────────────────────────
function ResponseCard({ idx, q, onRemove, onPickOpen }: { idx: number; q: SlotQ | null; onRemove: () => void; onPickOpen?: () => void }) {
  if (!q) return (
    <button
      onClick={onPickOpen}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-200 text-xs text-gray-300 bg-gray-50 hover:border-emerald-300 hover:text-emerald-400 hover:bg-emerald-50 transition">
      <span className="w-5 text-center font-bold">{idx + 1}</span>
      <span>빈 슬롯 — 클릭하여 직접 선택</span>
    </button>
  )
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-white hover:border-emerald-200 transition group">
      <span className="w-5 text-xs font-bold text-gray-400 mt-0.5 flex-shrink-0 text-center">{idx + 1}</span>
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

// ─── 오디오 세트 카드 ───────────────────────────────
function AudioSetCard({
  idx, set, label, accent,
  onSwap, onRemove, onPickOpen,
}: {
  idx: number
  set: AudioSet | null
  label: string
  accent: string
  onSwap: () => void
  onRemove: () => void
  onPickOpen: () => void
}) {
  if (!set) return (
    <button
      onClick={onPickOpen}
      className={`w-full rounded-xl border-2 border-dashed ${accent === 'emerald' ? 'border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-500' : 'border-blue-200 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-500'} px-3 py-2 text-xs text-gray-300 flex items-center justify-center h-10 transition`}>
      {label} 세트 {idx + 1} — 클릭하여 선택
    </button>
  )

  const avgDiff = Math.round(set.questions.reduce((s, q) => s + q.difficulty, 0) / set.questions.length)

  return (
    <div className="rounded-xl border border-gray-100 bg-white overflow-hidden hover:border-emerald-200 transition group">
      {/* 세트 헤더 */}
      <div className={`flex items-center justify-between px-3 py-2 ${accent === 'emerald' ? 'bg-emerald-50' : 'bg-blue-50'}`}>
        <div className="flex items-center gap-2">
          <Volume2 size={12} className={accent === 'emerald' ? 'text-emerald-600' : 'text-blue-600'} />
          <span className={`text-xs font-bold ${accent === 'emerald' ? 'text-emerald-800' : 'text-blue-800'}`}>
            {label} {idx + 1}
          </span>
          <span className="text-[10px] text-gray-400">{set.questions.length}문항</span>
          <BandBadge d={avgDiff} />
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
          <button onClick={onSwap}
            className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 font-bold">
            교체
          </button>
          <button onClick={onRemove}
            className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-500 rounded hover:bg-red-100 font-bold">
            제거
          </button>
        </div>
      </div>

      {/* 오디오 플레이어 */}
      {set.audioUrl ? (
        <div className="px-3 py-1 border-b border-gray-50">
          <audio controls src={set.audioUrl} className="w-full h-6" />
        </div>
      ) : (
        <div className="px-3 py-1 border-b border-gray-50 flex items-center gap-1.5 text-[10px] text-gray-300">
          <Volume2 size={10} />
          <span>오디오 없음</span>
        </div>
      )}

      {/* 하위 문제 목록 */}
      <div className="divide-y divide-gray-50">
        {set.questions.map((q, i) => (
          <div key={q.id} className="flex items-start gap-2 px-3 py-1">
            <span className="text-[10px] font-bold text-gray-400 w-3 mt-0.5">{i + 1}</span>
            <p className="text-xs text-gray-600 line-clamp-1 flex-1">{q.content}</p>
            <BandBadge d={q.difficulty} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── SlotGroup (Response용) ──────────────────────────
function ResponseGroup({
  slots, label, filling, onFill, onRemove, onResize, minCount, maxCount, onPickOpen,
}: {
  slots: (SlotQ | null)[]
  label: string
  filling: boolean
  onFill: () => void
  onRemove: (idx: number) => void
  onResize: (delta: 1 | -1) => void
  minCount: number
  maxCount: number
  onPickOpen: (idx: number) => void
}) {
  const filled = slots.filter(Boolean).length
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-gray-700">{label}</span>
          <div className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg px-1 py-0.5">
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
          <span className="text-[10px] text-gray-400">{filled}개 채움</span>
        </div>
        <button onClick={onFill} disabled={filling} title="Magic Fill"
          className="inline-flex items-center justify-center w-7 h-7 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-lg transition">
          {filling ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
        </button>
      </div>
      <div className="space-y-1.5">
        {slots.map((q, i) => (
          <ResponseCard key={i} idx={i} q={q} onRemove={() => onRemove(i)} onPickOpen={() => onPickOpen(i)} />
        ))}
      </div>
    </div>
  )
}

// ─── SetGroup (Conv/Talk용) ──────────────────────────
function SetGroup({
  sets, label, accent, filling, onFill, onSwap, onRemove, onResize, minCount, maxCount, onPickOpen,
}: {
  sets: (AudioSet | null)[]
  label: string
  accent: string
  filling: boolean
  onFill: () => void
  onSwap: (idx: number, s: AudioSet) => void
  onRemove: (idx: number) => void
  onResize: (delta: 1 | -1) => void
  minCount: number
  maxCount: number
  onPickOpen: (idx: number) => void
}) {
  const filled = sets.filter(Boolean).length
  const totalQ = sets.filter(Boolean).reduce((s, set) => s + set!.questions.length, 0)
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Volume2 size={12} className={accent === 'emerald' ? 'text-emerald-500' : 'text-blue-500'} />
          <span className="text-xs font-bold text-gray-700">{label}</span>
          <div className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg px-1 py-0.5">
            <button onClick={() => onResize(-1)} disabled={sets.length <= minCount}
              className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-800 disabled:opacity-30 transition">
              <Minus size={9} />
            </button>
            <span className="text-[11px] font-bold text-gray-700 w-5 text-center">{sets.length}</span>
            <button onClick={() => onResize(1)} disabled={sets.length >= maxCount}
              className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-800 disabled:opacity-30 transition">
              <Plus size={9} />
            </button>
          </div>
          <span className="text-[10px] text-gray-400">{filled}/{sets.length} 세트 · {totalQ}문항 채움</span>
        </div>
        <button onClick={onFill} disabled={filling} title="Magic Fill"
          className="inline-flex items-center justify-center w-7 h-7 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-lg transition">
          {filling ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
        </button>
      </div>
      <div className="space-y-2">
        {sets.map((set, i) => (
          <AudioSetCard key={i} idx={i} set={set} label={label} accent={accent}
            onSwap={() => set && onSwap(i, set)}
            onRemove={() => onRemove(i)}
            onPickOpen={() => onPickOpen(i)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Module Column ───────────────────────────────────
function ModuleColumn({
  title, subtitle, headerColor, borderColor,
  mod, moduleName, filling, totalFilled, totalSlots,
  onMagicFillAll, onFill, onSwapSet, onRemoveResponse, onRemoveSet, onResize, onPickResponseOpen, onPickSetOpen,
}: {
  title: string
  subtitle: string
  headerColor: string
  borderColor: string
  mod: ListeningModSlots
  moduleName: 'LM1' | 'LM2up' | 'LM2down'
  filling: string | null
  totalFilled: number
  totalSlots: number
  onMagicFillAll: () => void
  onFill: (slotType: 'response' | 'conversation' | 'academicTalk') => void
  onSwapSet: (slotType: 'conversation' | 'academicTalk', idx: number, set: AudioSet) => void
  onRemoveResponse: (idx: number) => void
  onRemoveSet: (slotType: 'conversation' | 'academicTalk', idx: number) => void
  onResize: (slotType: 'response' | 'conversation' | 'academicTalk', delta: 1 | -1) => void
  onPickResponseOpen: (idx: number) => void
  onPickSetOpen: (slotType: 'conversation' | 'academicTalk', idx: number) => void
}) {
  const accent = moduleName === 'LM1' ? 'gray' : moduleName === 'LM2up' ? 'emerald' : 'amber'
  const range = LISTEN_RANGE[moduleName]
  return (
    <div className={`flex-1 bg-white rounded-2xl border ${borderColor} shadow-sm overflow-hidden`}>
      <div className={`px-4 py-3 ${headerColor} border-b`}>
        <div className="flex items-center justify-between">
          <div>
            {moduleName !== 'LM1' && (
              <div className="flex items-center gap-1 mb-0.5">
                {moduleName === 'LM2up'
                  ? <ArrowUp size={12} className="text-emerald-600" />
                  : <ArrowDown size={12} className="text-amber-600" />}
                <h3 className={`font-extrabold text-sm ${moduleName === 'LM2up' ? 'text-emerald-900' : 'text-amber-900'}`}>{title}</h3>
              </div>
            )}
            {moduleName === 'LM1' && <h3 className="font-extrabold text-gray-900 text-sm">{title}</h3>}
            <p className="text-[11px] text-gray-400">{subtitle}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs font-bold text-gray-700">{totalFilled}/{totalSlots} 채움</span>
            <button onClick={onMagicFillAll} disabled={!!filling} title="전체 Fill"
              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-lg transition">
              {filling?.startsWith(moduleName) ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
              All
            </button>
          </div>
        </div>
      </div>
      <div className="p-3 overflow-y-auto max-h-[70vh]">
        <ResponseGroup
          slots={mod.response} label="🎧 Response (개별)"
          filling={filling === `${moduleName}_response`}
          onFill={() => onFill('response')}
          onRemove={onRemoveResponse}
          onResize={d => onResize('response', d)}
          minCount={range.response.min} maxCount={range.response.max}
          onPickOpen={onPickResponseOpen}
        />
        <SetGroup
          sets={mod.conversation} label="💬 Conversation" accent="emerald"
          filling={filling === `${moduleName}_conversation`}
          onFill={() => onFill('conversation')}
          onSwap={(i, s) => onSwapSet('conversation', i, s)}
          onRemove={i => onRemoveSet('conversation', i)}
          onResize={d => onResize('conversation', d)}
          minCount={range.conversation.min} maxCount={range.conversation.max}
          onPickOpen={i => onPickSetOpen('conversation', i)}
        />
        <SetGroup
          sets={mod.academicTalk} label="🎓 Academic Talk" accent="blue"
          filling={filling === `${moduleName}_academicTalk`}
          onFill={() => onFill('academicTalk')}
          onSwap={(i, s) => onSwapSet('academicTalk', i, s)}
          onRemove={i => onRemoveSet('academicTalk', i)}
          onResize={d => onResize('academicTalk', d)}
          minCount={range.academicTalk.min} maxCount={range.academicTalk.max}
          onPickOpen={i => onPickSetOpen('academicTalk', i)}
        />
      </div>
    </div>
  )
}

// ─── 메인 Listening Canvas ───────────────────────────
export interface ListeningCanvasProps {
  lm1: ListeningModSlots;    setLM1: React.Dispatch<React.SetStateAction<ListeningModSlots>>
  lm2up: ListeningModSlots;  setLM2Up: React.Dispatch<React.SetStateAction<ListeningModSlots>>
  lm2down: ListeningModSlots; setLM2Down: React.Dispatch<React.SetStateAction<ListeningModSlots>>
  classId: string
  targetBand: number
  maxBand: number
  filling: string | null
  setFilling: (v: string | null) => void
  allIds: string[]
}

export default function ListeningCanvas({
  lm1, setLM1, lm2up, setLM2Up, lm2down, setLM2Down,
  classId, targetBand, maxBand, filling, setFilling, allIds,
}: ListeningCanvasProps) {

  // Response 직접 선택 상태
  const [respPicker, setRespPicker] = useState<{
    mod: 'LM1' | 'LM2up' | 'LM2down'
    idx: number
  } | null>(null)

  // Set(Conversation/Academic Talk) 직접 선택 상태
  const [slotPicker, setSlotPicker] = useState<{
    mod: 'LM1' | 'LM2up' | 'LM2down'
    slotType: 'conversation' | 'academicTalk'
    idx: number
  } | null>(null)

  function handlePickSelect(picked: PickedQuestion) {
    if (!respPicker) return
    const { mod, idx } = respPicker
    const q: SlotQ = {
      id: picked.id,
      content: picked.content,
      difficulty: picked.difficulty,
      question_subtype: picked.question_subtype,
      audio_url: null,
      audio_id: null,
      type: picked.type,
    }
    const setter = mod === 'LM1' ? setLM1 : mod === 'LM2up' ? setLM2Up : setLM2Down
    setter(prev => {
      const arr = [...prev.response] as (SlotQ | null)[]
      arr[idx] = q
      return { ...prev, response: arr }
    })
    setRespPicker(null)
  }

  function handleSetPickSelect(qs: PickedQuestion[]) {
    if (!slotPicker || qs.length === 0) return
    const { mod, slotType, idx } = slotPicker
    const newSet: AudioSet = {
      audioId: qs[0].id,
      audioUrl: qs[0].audio_url ?? null,
      questions: qs.map(q => ({
        id: q.id, content: q.content, difficulty: q.difficulty,
        question_subtype: q.question_subtype, audio_url: q.audio_url,
        audio_id: null, type: q.type ?? 'listening',
      })),
    }
    const setter = mod === 'LM1' ? setLM1 : mod === 'LM2up' ? setLM2Up : setLM2Down
    setter(prev => {
      const arr = [...prev[slotType]] as (AudioSet | null)[]
      arr[idx] = newSet
      return { ...prev, [slotType]: arr }
    })
    setSlotPicker(null)
  }

  // ── 슬롯 수 조절 (Elastic) ──
  function resizeListen(
    mod: 'LM1'|'LM2up'|'LM2down',
    slotType: 'response'|'conversation'|'academicTalk',
    delta: 1|-1,
  ) {
    const setter = mod === 'LM1' ? setLM1 : mod === 'LM2up' ? setLM2Up : setLM2Down
    setter(prev => {
      const arr = [...prev[slotType]] as (typeof prev[typeof slotType][number] | null)[]
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

  // ── 슬롯 제거 ──
  function removeResponse(mod: 'LM1'|'LM2up'|'LM2down', idx: number) {
    const setter = mod === 'LM1' ? setLM1 : mod === 'LM2up' ? setLM2Up : setLM2Down
    setter(prev => { const r = [...prev.response]; r[idx] = null; return { ...prev, response: r } })
  }
  function removeSet(mod: 'LM1'|'LM2up'|'LM2down', slotType: 'conversation'|'academicTalk', idx: number) {
    const setter = mod === 'LM1' ? setLM1 : mod === 'LM2up' ? setLM2Up : setLM2Down
    setter(prev => {
      const arr = [...prev[slotType]]; arr[idx] = null
      return { ...prev, [slotType]: arr }
    })
  }

  // ── Magic Fill ──
  async function magicFill(
    mod: 'LM1'|'LM2up'|'LM2down',
    slotType: 'response'|'conversation'|'academicTalk',
  ) {
    const key = `${mod}_${slotType}`
    setFilling(key)

    try {
      const current = mod === 'LM1' ? lm1 : mod === 'LM2up' ? lm2up : lm2down
      const module   = mod === 'LM1' ? 'M1' : mod === 'LM2up' ? 'M2up' : 'M2down'

      // targetCount 계산
      let targetCount = 0
      if (slotType === 'response') {
        targetCount = current.response.filter(s => !s).length
      } else if (slotType === 'conversation') {
        const emptySets = current.conversation.filter(s => !s).length
        targetCount = emptySets * 2  // 각 세트 2문항
      } else {
        // academicTalk: 남은 세트 수 × 평균 4문항
        const emptySets = current.academicTalk.filter(s => !s).length
        targetCount = emptySets * 4
      }

      if (targetCount <= 0) return

      const res = await fetch('/api/teacher/listening-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId, targetBand, maxBand, module,
          slotType: slotType === 'academicTalk' ? 'academic_talk' : slotType,
          targetCount,
          excludeIds: allIds,
        }),
      })
      const data = await res.json()
      if (!res.ok) return

      const setter = mod === 'LM1' ? setLM1 : mod === 'LM2up' ? setLM2Up : setLM2Down

      if (data.type === 'response') {
        const newQs: SlotQ[] = data.questions
        let qi = 0
        setter(prev => ({
          ...prev,
          response: prev.response.map(s => s ?? (newQs[qi++] ?? null)),
        }))
      } else {
        // sets
        const newSets: AudioSet[] = data.sets
        let si = 0
        setter(prev => ({
          ...prev,
          [slotType]: prev[slotType].map((s) => s ?? (newSets[si++] ?? null)),
        }))
      }
    } catch {
      // 네트워크 오류 등 — 버튼은 반드시 해제
    } finally {
      setFilling(null)  // ← 어떤 경우에도 반드시 해제
    }
  }

  // 각 모듈 총계
  function countFilled(mod: ListeningModSlots) {
    return mod.response.filter(Boolean).length
      + mod.conversation.filter(Boolean).reduce((s, set) => s + set!.questions.length, 0)
      + mod.academicTalk.filter(Boolean).reduce((s, set) => s + set!.questions.length, 0)
  }
  function totalSlots(respLen: number, convLen: number, talkLen: number) {
    return respLen + convLen * 2 + talkLen * 4  // 대략적 총계
  }

  const makeProps = (
    mod: ListeningModSlots,
    modName: 'LM1'|'LM2up'|'LM2down',
    setter: React.Dispatch<React.SetStateAction<ListeningModSlots>>,
    respLen: number, convLen: number, talkLen: number,
  ) => ({
    mod, moduleName: modName as 'LM1'|'LM2up'|'LM2down',
    filling,
    totalFilled: countFilled(mod),
    totalSlots: totalSlots(respLen, convLen, talkLen),
    onMagicFillAll: async () => {
      await magicFill(modName, 'response')
      await magicFill(modName, 'conversation')
      await magicFill(modName, 'academicTalk')
    },
    onFill: (st: 'response'|'conversation'|'academicTalk') => magicFill(modName, st),
    onSwapSet: (st: 'conversation'|'academicTalk', i: number, _s: AudioSet) => {
      setSlotPicker({ mod: modName, slotType: st, idx: i })
    },
    onRemoveResponse: (i: number) => removeResponse(modName, i),
    onRemoveSet: (st: 'conversation'|'academicTalk', i: number) => removeSet(modName, st, i),
    onResize: (st: 'response'|'conversation'|'academicTalk', d: 1|-1) => resizeListen(modName, st, d),
    onPickResponseOpen: (i: number) => setRespPicker({ mod: modName, idx: i }),
    onPickSetOpen: (st: 'conversation'|'academicTalk', i: number) => setSlotPicker({ mod: modName, slotType: st, idx: i }),
  })

  const lm1Filled = countFilled(lm1)
  const lm2upFilled = countFilled(lm2up)
  const lm2downFilled = countFilled(lm2down)
  const lm1Total = totalSlots(lm1.response.length, lm1.conversation.length, lm1.academicTalk.length)
  const lm2upTotal = totalSlots(lm2up.response.length, lm2up.conversation.length, lm2up.academicTalk.length)
  const lm2downTotal = totalSlots(lm2down.response.length, lm2down.conversation.length, lm2down.academicTalk.length)

  const lEstimatedSec = [
    ...lm1.response.filter(Boolean).map(() => DEFAULT_TIME_LIMITS['choose_response'] ?? 30),
    ...lm1.conversation.filter(Boolean).flatMap(s => s!.questions.map(() => DEFAULT_TIME_LIMITS['conversation'] ?? 30)),
    ...lm1.academicTalk.filter(Boolean).flatMap(s => s!.questions.map(() => DEFAULT_TIME_LIMITS['academic_talk'] ?? 30)),
    ...lm2up.response.filter(Boolean).map(() => DEFAULT_TIME_LIMITS['choose_response'] ?? 30),
    ...lm2up.conversation.filter(Boolean).flatMap(s => s!.questions.map(() => DEFAULT_TIME_LIMITS['conversation'] ?? 30)),
    ...lm2up.academicTalk.filter(Boolean).flatMap(s => s!.questions.map(() => DEFAULT_TIME_LIMITS['academic_talk'] ?? 30)),
    ...lm2down.response.filter(Boolean).map(() => DEFAULT_TIME_LIMITS['choose_response'] ?? 30),
    ...lm2down.conversation.filter(Boolean).flatMap(s => s!.questions.map(() => DEFAULT_TIME_LIMITS['conversation'] ?? 30)),
    ...lm2down.academicTalk.filter(Boolean).flatMap(s => s!.questions.map(() => DEFAULT_TIME_LIMITS['academic_talk'] ?? 30)),
  ].reduce((a, b) => a + b, 0)

  return (
    <div className="flex flex-col h-full">

      {/* ── 실시간 분석 (가로) ── */}
      <div className="flex items-center gap-4 px-6 py-2 bg-emerald-50/60 border-b border-emerald-100 flex-shrink-0 flex-wrap text-xs">
        <span className="font-extrabold text-emerald-700 text-[11px]">실시간 분석</span>
        <div className="flex items-center gap-2.5">
          {[
            { label: 'LM1',  filled: lm1Filled,     total: lm1Total,     color: 'text-gray-700' },
            { label: 'LM2↑', filled: lm2upFilled,   total: lm2upTotal,   color: 'text-emerald-600' },
            { label: 'LM2↓', filled: lm2downFilled, total: lm2downTotal, color: 'text-amber-600' },
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
        <div className="h-3 w-px bg-emerald-200" />
        <div className="flex items-center gap-1">
          <Clock size={11} className="text-emerald-400" />
          <span className="text-gray-500">예상 시간:</span>
          <span className="font-bold text-gray-700">{lEstimatedSec > 0 ? formatSeconds(lEstimatedSec) : '—'}</span>
        </div>
      </div>

      <div className="flex gap-3 p-4 min-w-[900px] flex-1 overflow-auto items-start">

      {/* Module 1 */}
      <ModuleColumn
        title="Module 1" subtitle="공통 모듈 — 전체 학생 (30문항)"
        headerColor="bg-gray-50" borderColor="border-gray-100"
        {...makeProps(lm1, 'LM1', setLM1, 12, 3, 3)}
      />

      {/* Module 2-Up */}
      <ModuleColumn
        title="Module 2-Up" subtitle="M1 70%+ → 진입 (15문항)"
        headerColor="bg-emerald-50" borderColor="border-emerald-100"
        {...makeProps(lm2up, 'LM2up', setLM2Up, 3, 2, 2)}
      />

      {/* Module 2-Down */}
      <ModuleColumn
        title="Module 2-Down" subtitle="M1 70% 미만 → 진입 (15문항)"
        headerColor="bg-amber-50" borderColor="border-amber-100"
        {...makeProps(lm2down, 'LM2down', setLM2Down, 3, 2, 2)}
      />

      <QuestionPickerModal
        open={!!respPicker}
        onClose={() => setRespPicker(null)}
        onSelect={handlePickSelect}
        category="listening"
        allowedSubtypes={['choose_response', 'announcement']}
        excludeIds={allIds}
        title="Listening Response 문제 직접 선택"
      />
      <QuestionPickerModal
        open={!!slotPicker}
        onClose={() => setSlotPicker(null)}
        onSelect={() => {}}
        onSelectSet={handleSetPickSelect}
        category="listening"
        allowedSubtypes={slotPicker?.slotType === 'conversation' ? ['conversation'] : ['academic_talk', 'campus_announcement']}
        excludeIds={allIds}
        title={slotPicker?.slotType === 'conversation' ? 'Conversation 세트 선택' : 'Academic Talk 세트 선택'}
      />
      </div>
    </div>
  )
}
