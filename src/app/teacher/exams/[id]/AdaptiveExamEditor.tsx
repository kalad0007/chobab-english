'use client'

import { useState, useCallback } from 'react'
import { BookOpen, Headphones, PenLine, Mic, Plus, X, Search, Loader2, ChevronUp, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updateExamDescription } from './actions'
import { ClickableQRow, type PreviewQuestion } from './QuestionPreview'
import { getDiffInfo } from '@/lib/utils'

// ── 타입 ─────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cfg = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QMap = Record<string, any>

interface AddTarget {
  label: string
  category: string
  subtypes: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doAdd: (cfg: Cfg, q: any) => Cfg
}

const SUBTYPE_LABEL: Record<string, string> = {
  complete_the_words: 'Complete the Words', sentence_completion: 'Sentence Completion',
  daily_life: 'Daily Life', academic_passage: 'Academic Passage',
  choose_response: 'Choose a Response', conversation: 'Conversation',
  campus_announcement: 'Campus Announcement', academic_talk: 'Academic Talk',
  sentence_reordering: 'Build a Sentence', email_writing: 'Write an Email',
  academic_discussion: 'Academic Discussion', listen_and_repeat: 'Listen & Repeat',
  take_an_interview: 'Interview',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPreview(q: any): PreviewQuestion {
  const diffInfo = q?.difficulty != null ? getDiffInfo(q.difficulty) : null
  return {
    id: q?.id ?? '',
    content: q?.content ?? '',
    summary: q?.summary,
    passage: q?.passage,
    options: q?.options,
    answer: q?.answer,
    audio_script: q?.audio_script,
    audio_url: q?.audio_url,
    category: q?.category ?? '',
    question_subtype: q?.question_subtype,
    difficulty: q?.difficulty,
    diffLabel: diffInfo?.label,
    diffColor: diffInfo?.color,
  }
}

// ── 섹션 헤더 ─────────────────────────────────────────
function SectionHead({ icon, title, count, color, border, onAdd }: {
  icon: React.ReactNode; title: string; count: number
  color: string; border: string; onAdd?: () => void
}) {
  return (
    <div className={`flex items-center justify-between px-5 py-3.5 ${color} border-b ${border}`}>
      <div className={`flex items-center gap-2 font-bold text-sm`}>{icon}{title}</div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-400">{count}문제</span>
        {onAdd && (
          <button onClick={onAdd}
            className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg bg-white/70 hover:bg-white border border-gray-200 text-gray-600 transition">
            <Plus size={11} /> 추가
          </button>
        )}
      </div>
    </div>
  )
}

// ── 행 액션 버튼 묶음 ─────────────────────────────────
function RowActions({ onMoveUp, onMoveDown, onRemove, isFirst, isLast }: {
  onMoveUp: () => void; onMoveDown: () => void; onRemove: () => void
  isFirst: boolean; isLast: boolean
}) {
  return (
    <div className="flex-shrink-0 flex items-center gap-0.5 mr-2 opacity-0 group-hover:opacity-100 transition">
      <button onClick={onMoveUp} disabled={isFirst}
        className="w-6 h-6 rounded-md hover:bg-gray-100 disabled:opacity-20 text-gray-400 flex items-center justify-center transition"
        title="위로">
        <ChevronUp size={12} />
      </button>
      <button onClick={onMoveDown} disabled={isLast}
        className="w-6 h-6 rounded-md hover:bg-gray-100 disabled:opacity-20 text-gray-400 flex items-center justify-center transition"
        title="아래로">
        <ChevronDown size={12} />
      </button>
      <button onClick={onRemove}
        className="w-6 h-6 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-400 flex items-center justify-center transition"
        title="제거">
        <X size={12} />
      </button>
    </div>
  )
}

// ── 서브그룹 (제목 + 문제 rows) ────────────────────────
function SubGroupEditable({ title, ids, qMap, onRemove, onMove }: {
  title: string; ids: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  qMap: QMap
  onRemove: (id: string) => void
  onMove: (id: string, dir: -1 | 1) => void
}) {
  if (ids.length === 0) return null
  return (
    <div>
      {title && (
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide px-4 py-1.5 bg-gray-50/80 border-y border-gray-100">
          {title} <span className="text-gray-300 font-normal">({ids.length})</span>
        </p>
      )}
      {ids.map((id, i) => (
        <div key={id} className="flex items-center group">
          <div className="flex-1 min-w-0">
            <ClickableQRow idx={i + 1} q={toPreview(qMap[id] ?? { id, content: id })} />
          </div>
          <RowActions
            isFirst={i === 0} isLast={i === ids.length - 1}
            onMoveUp={() => onMove(id, -1)}
            onMoveDown={() => onMove(id, 1)}
            onRemove={() => onRemove(id)}
          />
        </div>
      ))}
    </div>
  )
}

// ── 문제 추가 플로팅 패널 ─────────────────────────────
function AddQuestionPanel({ target, existingIds, onAdd, onClose }: {
  target: AddTarget
  existingIds: Set<string>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAdd: (q: any) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [questions, setQuestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useState(() => {
    async function load() {
      let q = supabase
        .from('questions')
        .select('id, content, summary, passage, options, answer, audio_script, audio_url, category, question_subtype, difficulty')
        .eq('category', target.category)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(200)

      if (target.subtypes.length > 0) {
        q = q.in('question_subtype', target.subtypes)
      }

      const { data } = await q
      setQuestions(data ?? [])
      setLoading(false)
    }
    load()
  })

  const filtered = questions.filter(q => {
    if (existingIds.has(q.id)) return false
    if (!search) return true
    const hay = (q.summary ?? q.content ?? '').toLowerCase()
    return hay.includes(search.toLowerCase())
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">{target.label} — 문제 추가</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {target.subtypes.map(s => SUBTYPE_LABEL[s] ?? s).join(' · ')}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition">
            <X size={14} />
          </button>
        </div>

        {/* 검색 */}
        <div className="px-4 py-3 border-b border-gray-50">
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
            <Search size={14} className="text-gray-400 flex-shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="문제 검색..."
              className="bg-transparent text-sm flex-1 outline-none text-gray-700 placeholder-gray-400"
            />
          </div>
        </div>

        {/* 목록 */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">추가할 문제가 없어요</p>
          ) : (
            filtered.map(q => {
              const diffInfo = q.difficulty != null ? getDiffInfo(q.difficulty) : null
              const display = q.summary ?? q.content ?? ''
              const label = SUBTYPE_LABEL[q.question_subtype] ?? q.question_subtype
              return (
                <button key={q.id} onClick={() => { onAdd(q); onClose() }}
                  className="w-full flex items-start gap-3 px-4 py-3 border-b border-gray-50 hover:bg-blue-50/40 transition text-left">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 line-clamp-1 font-medium">{display}</p>
                    <span className="text-[11px] text-indigo-400 mt-0.5 block">{label}</span>
                  </div>
                  {diffInfo && (
                    <span className={`text-[10px] font-bold flex-shrink-0 px-1.5 py-0.5 rounded-full mt-0.5 ${diffInfo.color}`}>
                      {diffInfo.label}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────
export default function AdaptiveExamEditor({ examId, initialCfg, initialQById }: {
  examId: string
  initialCfg: Cfg
  initialQById: QMap
}) {
  const [cfg, setCfg] = useState<Cfg>(initialCfg)
  const [qMap, setQMap] = useState<QMap>(initialQById)
  const [saving, setSaving] = useState(false)
  const [addTarget, setAddTarget] = useState<AddTarget | null>(null)

  const save = useCallback(async (newCfg: Cfg) => {
    setSaving(true)
    try {
      await updateExamDescription(examId, JSON.stringify(newCfg))
      setCfg(newCfg)
    } finally {
      setSaving(false)
    }
  }, [examId])

  // ── 제거 헬퍼 ──────────────────────────────────────

  function removeFromArray(path: string[], id: string) {
    const newCfg = JSON.parse(JSON.stringify(cfg))
    let node = newCfg
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]]
    const key = path[path.length - 1]
    node[key] = (node[key] as string[]).filter((x: string) => x !== id)
    save(newCfg)
  }

  function removeFromSet(modKey: string, setType: string, setIdx: number, id: string) {
    const newCfg = JSON.parse(JSON.stringify(cfg))
    const sets = newCfg[modKey][setType]
    sets[setIdx].questionIds = sets[setIdx].questionIds.filter((x: string) => x !== id)
    if (sets[setIdx].questionIds.length === 0) sets.splice(setIdx, 1)
    save(newCfg)
  }

  function moveInArray(path: string[], id: string, dir: -1 | 1) {
    const newCfg = JSON.parse(JSON.stringify(cfg))
    let node = newCfg
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]]
    const key = path[path.length - 1]
    const arr: string[] = node[key]
    const idx = arr.indexOf(id)
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= arr.length) return
    ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
    save(newCfg)
  }

  function moveInSet(modKey: string, setType: string, setIdx: number, id: string, dir: -1 | 1) {
    const newCfg = JSON.parse(JSON.stringify(cfg))
    const arr: string[] = newCfg[modKey][setType][setIdx].questionIds
    const idx = arr.indexOf(id)
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= arr.length) return
    ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
    save(newCfg)
  }

  // ── 추가 헬퍼 ──────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleAdd(target: AddTarget, q: any) {
    setQMap(prev => ({ ...prev, [q.id]: q }))
    const newCfg = target.doAdd(JSON.parse(JSON.stringify(cfg)), q)
    save(newCfg)
  }

  // ── 존재하는 모든 ID 집합 (중복 방지) ──────────────

  const existingIds = new Set<string>([
    ...(cfg.m1Ids ?? []), ...(cfg.m2upIds ?? []), ...(cfg.m2downIds ?? []),
    ...(['listening_m1', 'listening_m2up', 'listening_m2down'] as string[]).flatMap(mk => {
      const mod = cfg[mk]; if (!mod) return []
      return [
        ...(mod.response ?? []),
        ...(mod.conversation ?? []).flatMap((s: any) => s.questionIds ?? []),
        ...(mod.academicTalk ?? []).flatMap((s: any) => s.questionIds ?? []),
      ]
    }),
    ...(cfg.writing?.reorderingIds ?? []), ...(cfg.writing?.emailIds ?? []),
    ...(cfg.speaking?.listenRepeatIds ?? []), ...(cfg.speaking?.interviewIds ?? []),
  ])

  // ── Listening 모듈 렌더 ────────────────────────────

  function renderListeningMod(modKey: string, modLabel: string, modColor: string, modTextColor: string) {
    const mod = cfg[modKey]
    if (!mod) return null
    const respIds: string[] = mod.response ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const convSets: any[] = mod.conversation ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const talkSets: any[] = mod.academicTalk ?? []
    const total = respIds.length + convSets.reduce((a, s) => a + s.questionIds.length, 0) + talkSets.reduce((a, s) => a + s.questionIds.length, 0)
    if (total === 0) return null

    const respTarget: AddTarget = {
      label: `Listening ${modLabel} — Choose a Response`,
      category: 'listening',
      subtypes: ['choose_response'],
      doAdd: (c, q) => { c[modKey].response = [...(c[modKey].response ?? []), q.id]; return c },
    }

    return (
      <div className="mb-3 last:mb-0">
        <div className={`flex items-center justify-between px-4 py-1.5 ${modColor} border-y border-emerald-100/60`}>
          <span className={`text-[11px] font-bold ${modTextColor} uppercase tracking-wide`}>{modLabel}</span>
          <span className="text-[11px] text-emerald-500 ml-1">· {total}문제</span>
        </div>

        {/* Choose a Response */}
        <div>
          <div className="flex items-center justify-between px-4 py-1 bg-gray-50/60 border-b border-gray-100">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Choose a Response ({respIds.length})</span>
            <button onClick={() => setAddTarget(respTarget)}
              className="flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-blue-600 transition">
              <Plus size={10} /> 추가
            </button>
          </div>
          {respIds.map((id, i) => (
            <div key={id} className="flex items-center group">
              <div className="flex-1 min-w-0">
                <ClickableQRow idx={i + 1} q={toPreview(qMap[id] ?? { id, content: id })} />
              </div>
              <RowActions
                isFirst={i === 0} isLast={i === respIds.length - 1}
                onMoveUp={() => moveInArray([modKey, 'response'], id, -1)}
                onMoveDown={() => moveInArray([modKey, 'response'], id, 1)}
                onRemove={() => removeFromArray([modKey, 'response'], id)}
              />
            </div>
          ))}
        </div>

        {/* Conversation sets */}
        {convSets.map((s, si) => (
          <div key={si}>
            <p className="text-[11px] font-bold text-gray-400 uppercase px-4 py-1.5 bg-gray-50 border-y border-gray-100">
              Conversation Set {si + 1} ({s.questionIds.length}문제)
            </p>
            {s.questionIds.map((id: string, i: number) => (
              <div key={id} className="flex items-center group">
                <div className="flex-1 min-w-0">
                  <ClickableQRow idx={i + 1} q={toPreview(qMap[id] ?? { id, content: id })} />
                </div>
                <RowActions
                  isFirst={i === 0} isLast={i === s.questionIds.length - 1}
                  onMoveUp={() => moveInSet(modKey, 'conversation', si, id, -1)}
                  onMoveDown={() => moveInSet(modKey, 'conversation', si, id, 1)}
                  onRemove={() => removeFromSet(modKey, 'conversation', si, id)}
                />
              </div>
            ))}
          </div>
        ))}

        {/* Academic Talk sets */}
        {talkSets.map((s, si) => (
          <div key={si}>
            <p className="text-[11px] font-bold text-gray-400 uppercase px-4 py-1.5 bg-gray-50 border-y border-gray-100">
              Academic Talk Set {si + 1} ({s.questionIds.length}문제)
            </p>
            {s.questionIds.map((id: string, i: number) => (
              <div key={id} className="flex items-center group">
                <div className="flex-1 min-w-0">
                  <ClickableQRow idx={i + 1} q={toPreview(qMap[id] ?? { id, content: id })} />
                </div>
                <RowActions
                  isFirst={i === 0} isLast={i === s.questionIds.length - 1}
                  onMoveUp={() => moveInSet(modKey, 'academicTalk', si, id, -1)}
                  onMoveDown={() => moveInSet(modKey, 'academicTalk', si, id, 1)}
                  onRemove={() => removeFromSet(modKey, 'academicTalk', si, id)}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  const readCount = (cfg.m1Ids?.length ?? 0) + (cfg.m2upIds?.length ?? 0) + (cfg.m2downIds?.length ?? 0)
  const calcMod = (mod: any) => !mod ? 0 :
    (mod.response?.length ?? 0) +
    (mod.conversation ?? []).reduce((a: number, s: any) => a + s.questionIds.length, 0) +
    (mod.academicTalk ?? []).reduce((a: number, s: any) => a + s.questionIds.length, 0)
  const listenCount = calcMod(cfg.listening_m1) + calcMod(cfg.listening_m2up) + calcMod(cfg.listening_m2down)
  const writeCount = (cfg.writing?.reorderingIds?.length ?? 0) + (cfg.writing?.emailIds?.length ?? 0)
  const speakCount = (cfg.speaking?.listenRepeatIds?.length ?? 0) + (cfg.speaking?.interviewIds?.length ?? 0)

  const readTargets = (path: string[], modLabel: string): AddTarget => ({
    label: `Reading ${modLabel}`,
    category: 'reading',
    subtypes: ['complete_the_words', 'sentence_completion', 'daily_life', 'academic_passage'],
    doAdd: (c, q) => { c[path[0]] = [...(c[path[0]] ?? []), q.id]; return c },
  })

  return (
    <div className="space-y-4">
      {saving && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-white border border-gray-200 shadow-lg rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600">
          <Loader2 size={14} className="animate-spin text-blue-500" /> 저장 중...
        </div>
      )}

      {/* Reading */}
      {readCount > 0 && (
        <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
          <SectionHead icon={<BookOpen size={15} className="text-blue-600" />} title="Reading" count={readCount}
            color="bg-blue-50/50" border="border-blue-100" />

          {(cfg.m1Ids?.length ?? 0) > 0 && (
            <div>
              <div className="flex items-center justify-between px-4 py-1.5 bg-blue-50/30 border-b border-blue-50">
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wide">Module 1 · {cfg.m1Ids.length}문제</span>
                <button onClick={() => setAddTarget(readTargets(['m1Ids'], 'Module 1'))}
                  className="flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-blue-600 transition">
                  <Plus size={10} /> 추가
                </button>
              </div>
              <SubGroupEditable title="" ids={cfg.m1Ids} qMap={qMap} onRemove={id => removeFromArray(['m1Ids'], id)} onMove={(id, d) => moveInArray(['m1Ids'], id, d)} />
            </div>
          )}
          {(cfg.m2upIds?.length ?? 0) > 0 && (
            <div>
              <div className="flex items-center justify-between px-4 py-1.5 bg-sky-50/50 border-b border-blue-50">
                <span className="text-[11px] font-bold text-sky-600 uppercase tracking-wide">Module 2 — 향상반 · {cfg.m2upIds.length}문제</span>
                <button onClick={() => setAddTarget(readTargets(['m2upIds'], 'Module 2 향상'))}
                  className="flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-blue-600 transition">
                  <Plus size={10} /> 추가
                </button>
              </div>
              <SubGroupEditable title="" ids={cfg.m2upIds} qMap={qMap} onRemove={id => removeFromArray(['m2upIds'], id)} onMove={(id, d) => moveInArray(['m2upIds'], id, d)} />
            </div>
          )}
          {(cfg.m2downIds?.length ?? 0) > 0 && (
            <div>
              <div className="flex items-center justify-between px-4 py-1.5 bg-indigo-50/50 border-b border-blue-50">
                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wide">Module 2 — 보완반 · {cfg.m2downIds.length}문제</span>
                <button onClick={() => setAddTarget(readTargets(['m2downIds'], 'Module 2 보완'))}
                  className="flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-blue-600 transition">
                  <Plus size={10} /> 추가
                </button>
              </div>
              <SubGroupEditable title="" ids={cfg.m2downIds} qMap={qMap} onRemove={id => removeFromArray(['m2downIds'], id)} onMove={(id, d) => moveInArray(['m2downIds'], id, d)} />
            </div>
          )}
        </div>
      )}

      {/* Listening */}
      {listenCount > 0 && (
        <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
          <SectionHead icon={<Headphones size={15} className="text-emerald-600" />} title="Listening" count={listenCount}
            color="bg-emerald-50/50" border="border-emerald-100" />
          {renderListeningMod('listening_m1', 'Module 1', 'bg-emerald-50/60', 'text-emerald-700')}
          {renderListeningMod('listening_m2up', 'Module 2 — 향상반', 'bg-teal-50/60', 'text-teal-700')}
          {renderListeningMod('listening_m2down', 'Module 2 — 보완반', 'bg-cyan-50/60', 'text-cyan-700')}
        </div>
      )}

      {/* Writing */}
      {writeCount > 0 && (
        <div className="bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden">
          <SectionHead icon={<PenLine size={15} className="text-purple-600" />} title="Writing" count={writeCount}
            color="bg-purple-50/50" border="border-purple-100" />
          {(cfg.writing?.reorderingIds?.length ?? 0) > 0 && (
            <div>
              <div className="flex items-center justify-between px-4 py-1.5 bg-gray-50/80 border-b border-gray-100">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Build a Sentence ({cfg.writing.reorderingIds.length})</span>
                <button onClick={() => setAddTarget({
                  label: 'Writing — Build a Sentence', category: 'writing',
                  subtypes: ['sentence_reordering'],
                  doAdd: (c, q) => { c.writing.reorderingIds = [...c.writing.reorderingIds, q.id]; return c },
                })} className="flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-purple-600 transition">
                  <Plus size={10} /> 추가
                </button>
              </div>
              <SubGroupEditable title="" ids={cfg.writing.reorderingIds} qMap={qMap} onRemove={id => removeFromArray(['writing', 'reorderingIds'], id)} onMove={(id, d) => moveInArray(['writing', 'reorderingIds'], id, d)} />
            </div>
          )}
          {(cfg.writing?.emailIds?.length ?? 0) > 0 && (
            <div>
              <div className="flex items-center justify-between px-4 py-1.5 bg-gray-50/80 border-b border-gray-100">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Write an Email ({cfg.writing.emailIds.length})</span>
                <button onClick={() => setAddTarget({
                  label: 'Writing — Write an Email', category: 'writing',
                  subtypes: ['email_writing'],
                  doAdd: (c, q) => { c.writing.emailIds = [...c.writing.emailIds, q.id]; return c },
                })} className="flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-purple-600 transition">
                  <Plus size={10} /> 추가
                </button>
              </div>
              <SubGroupEditable title="" ids={cfg.writing.emailIds} qMap={qMap} onRemove={id => removeFromArray(['writing', 'emailIds'], id)} onMove={(id, d) => moveInArray(['writing', 'emailIds'], id, d)} />
            </div>
          )}
        </div>
      )}

      {/* Speaking */}
      {speakCount > 0 && (
        <div className="bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden">
          <SectionHead icon={<Mic size={15} className="text-orange-500" />} title="Speaking" count={speakCount}
            color="bg-orange-50/50" border="border-orange-100" />
          {(cfg.speaking?.listenRepeatIds?.length ?? 0) > 0 && (
            <div>
              <div className="flex items-center justify-between px-4 py-1.5 bg-gray-50/80 border-b border-gray-100">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Listen & Repeat ({cfg.speaking.listenRepeatIds.length})</span>
                <button onClick={() => setAddTarget({
                  label: 'Speaking — Listen & Repeat', category: 'speaking',
                  subtypes: ['listen_and_repeat'],
                  doAdd: (c, q) => { c.speaking.listenRepeatIds = [...c.speaking.listenRepeatIds, q.id]; return c },
                })} className="flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-orange-600 transition">
                  <Plus size={10} /> 추가
                </button>
              </div>
              <SubGroupEditable title="" ids={cfg.speaking.listenRepeatIds} qMap={qMap} onRemove={id => removeFromArray(['speaking', 'listenRepeatIds'], id)} onMove={(id, d) => moveInArray(['speaking', 'listenRepeatIds'], id, d)} />
            </div>
          )}
          {(cfg.speaking?.interviewIds?.length ?? 0) > 0 && (
            <div>
              <div className="flex items-center justify-between px-4 py-1.5 bg-gray-50/80 border-b border-gray-100">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Interview ({cfg.speaking.interviewIds.length})</span>
                <button onClick={() => setAddTarget({
                  label: 'Speaking — Interview', category: 'speaking',
                  subtypes: ['take_an_interview'],
                  doAdd: (c, q) => { c.speaking.interviewIds = [...c.speaking.interviewIds, q.id]; return c },
                })} className="flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-orange-600 transition">
                  <Plus size={10} /> 추가
                </button>
              </div>
              <SubGroupEditable title="" ids={cfg.speaking.interviewIds} qMap={qMap} onRemove={id => removeFromArray(['speaking', 'interviewIds'], id)} onMove={(id, d) => moveInArray(['speaking', 'interviewIds'], id, d)} />
            </div>
          )}
        </div>
      )}

      {/* 추가 패널 */}
      {addTarget && (
        <AddQuestionPanel
          target={addTarget}
          existingIds={existingIds}
          onAdd={q => handleAdd(addTarget, q)}
          onClose={() => setAddTarget(null)}
        />
      )}
    </div>
  )
}
