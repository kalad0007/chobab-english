'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, X, ChevronLeft, ChevronRight, Check, Layers, Clock } from 'lucide-react'
import { DIFFICULTY_LEVELS, QUESTION_SUBTYPE_LABELS, ACTIVE_SUBTYPES, getDiffInfo, DEFAULT_TIME_LIMITS, formatSeconds } from '@/lib/utils'

export interface PickedQuestion {
  id: string
  content: string
  difficulty: number
  question_subtype: string | null
  type: string
  category: string
  time_limit?: number | null
  summary?: string | null
  subcategory?: string | null
  audio_url?: string | null
}

interface PassageSet {
  passage_group_id: string
  passage: string
  question_subtype: string | null
  difficulty: number
  questions: PickedQuestion[]
}

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (q: PickedQuestion) => void
  onSelectSet?: (qs: PickedQuestion[]) => void
  category: 'reading' | 'listening' | 'writing' | 'speaking'
  allowedSubtypes?: string[]
  excludeIds?: string[]
  title?: string
}

export default function QuestionPickerModal({
  open, onClose, onSelect, onSelectSet,
  category, allowedSubtypes, excludeIds = [], title,
}: Props) {
  const [mode, setMode]           = useState<'individual' | 'set'>('individual')
  const [keyword, setKeyword]     = useState('')
  const [subtype, setSubtype]     = useState('')
  const [diffFilter, setDiffFilter] = useState('')
  const [page, setPage]           = useState(1)
  const [questions, setQuestions] = useState<PickedQuestion[]>([])
  const [total, setTotal]         = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading]     = useState(false)
  const [selected, setSelected]   = useState<PickedQuestion | null>(null)

  // set 모드용
  const [sets, setSets]           = useState<PassageSet[]>([])
  const [setsTotal, setSetsTotal] = useState(0)
  const [setsLoading, setSetsLoading] = useState(false)
  const [selectedSet, setSelectedSet] = useState<PassageSet | null>(null)

  const subtypeMap = QUESTION_SUBTYPE_LABELS[category] ?? {}
  const activeSubtypes = ACTIVE_SUBTYPES[category] ?? []
  const subtypeOptions = allowedSubtypes
    ? allowedSubtypes.map(k => ({ key: k, label: subtypeMap[k] ?? k }))
    : activeSubtypes.map(o => ({ key: o.value, label: o.label }))

  const CAT_COLORS: Record<string, { active: string; inactive: string }> = {
    reading:   { active: 'bg-blue-600 text-white',    inactive: 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600' },
    listening: { active: 'bg-emerald-600 text-white',  inactive: 'bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-600' },
    writing:   { active: 'bg-purple-600 text-white',   inactive: 'bg-gray-100 text-gray-600 hover:bg-purple-50 hover:text-purple-600' },
    speaking:  { active: 'bg-orange-600 text-white',   inactive: 'bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600' },
  }
  const catColor = CAT_COLORS[category] ?? CAT_COLORS.reading

  // ── 개별 문제 검색 ──────────────────────────────────
  const doFetch = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ category, page: String(p) })
      if (subtype) {
        params.set('subtype', subtype)
      } else if (allowedSubtypes?.length) {
        // 슬롯 타입에 맞는 subtype만 기본 필터로 적용
        params.set('subtypes', allowedSubtypes.join(','))
      }
      if (diffFilter) params.set('difficulty', diffFilter)
      if (keyword)    params.set('q', keyword)
      const res  = await fetch(`/api/teacher/question-search?${params}`)
      const data = await res.json()
      setQuestions(data.questions ?? [])
      setTotal(data.total ?? 0)
      setTotalPages(data.totalPages ?? 1)
    } finally {
      setLoading(false)
    }
  }, [category, subtype, diffFilter, keyword, allowedSubtypes])

  // ── 세트 검색 ────────────────────────────────────────
  const doFetchSets = useCallback(async () => {
    setSetsLoading(true)
    try {
      const params = new URLSearchParams({ category })
      if (subtype) {
        params.set('subtype', subtype)
      } else if (allowedSubtypes?.length) {
        // 슬롯 타입에 맞는 subtype만 기본 필터로 적용
        params.set('subtypes', allowedSubtypes.join(','))
      }
      if (keyword) params.set('q', keyword)
      const res  = await fetch(`/api/teacher/set-search?${params}`)
      const data = await res.json()
      setSets(data.sets ?? [])
      setSetsTotal(data.total ?? 0)
    } finally {
      setSetsLoading(false)
    }
  }, [category, subtype, keyword, allowedSubtypes])

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (!open) return
    setKeyword('')
    setSubtype('')
    setDiffFilter('')
    setPage(1)
    setSelected(null)
    setSelectedSet(null)
    setMode('individual')
  }, [open, category])

  // 필터 변경 시 재조회 (개별)
  useEffect(() => {
    if (open && mode === 'individual') doFetch(page)
  }, [open, page, subtype, diffFilter, mode])

  // 키워드 debounce (개별)
  useEffect(() => {
    if (!open || mode !== 'individual') return
    const t = setTimeout(() => { setPage(1); doFetch(1) }, 350)
    return () => clearTimeout(t)
  }, [keyword])

  // 세트 모드 전환 or 필터 변경 시 조회
  useEffect(() => {
    if (open && mode === 'set') doFetchSets()
  }, [open, mode, subtype])

  // 키워드 debounce (세트)
  useEffect(() => {
    if (!open || mode !== 'set') return
    const t = setTimeout(() => doFetchSets(), 350)
    return () => clearTimeout(t)
  }, [keyword, mode])

  if (!open) return null

  const displayList = questions.filter(q => !excludeIds.includes(q.id))
  const displaySets = sets.filter(s => !s.questions.every(q => excludeIds.includes(q.id)))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-extrabold text-gray-900">{title ?? '문제 직접 선택'}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {category.charAt(0).toUpperCase() + category.slice(1)} ·{' '}
              {mode === 'individual' ? `총 ${total}개` : `세트 ${setsTotal}개`}
            </p>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition">
            <X size={18} />
          </button>
        </div>

        {/* 모드 탭 */}
        <div className="flex px-5 pt-3 gap-2 flex-shrink-0">
          <button
            onClick={() => { setMode('individual'); setSelected(null); setSelectedSet(null) }}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition ${
              mode === 'individual'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            개별 문제
          </button>
          {onSelectSet && (
            <button
              onClick={() => { setMode('set'); setSelected(null); setSelectedSet(null) }}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                mode === 'set'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              <Layers size={11} /> 문제 Set
            </button>
          )}
        </div>

        {/* 필터 */}
        <div className="px-5 py-3 border-b border-gray-100 space-y-2 flex-shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder={mode === 'set' ? '지문 / 문제 내용 검색...' : '문제 내용 검색...'}
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {subtypeOptions.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => { setSubtype(''); setPage(1) }}
                className={`text-xs px-3 py-1 rounded-full font-semibold transition ${!subtype ? catColor.active : catColor.inactive}`}>
                전체 유형
              </button>
              {subtypeOptions.map(o => (
                <button key={o.key}
                  onClick={() => { setSubtype(subtype === o.key ? '' : o.key); setPage(1) }}
                  className={`text-xs px-3 py-1 rounded-full font-semibold transition ${subtype === o.key ? catColor.active : catColor.inactive}`}>
                  {o.label.replace(/ ★NEW.*/, '').replace(/ \(.*\)/, '')}
                </button>
              ))}
            </div>
          )}

          {mode === 'individual' && (
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => { setDiffFilter(''); setPage(1) }}
                className={`text-xs px-3 py-1 rounded-full font-bold transition ${!diffFilter ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                전체 난이도
              </button>
              {DIFFICULTY_LEVELS.map(l => (
                <button key={l.value}
                  onClick={() => { setDiffFilter(diffFilter === String(l.value) ? '' : String(l.value)); setPage(1) }}
                  className={`text-xs px-3 py-1 rounded-full font-bold transition ${
                    diffFilter === String(l.value)
                      ? `${l.color} ring-2 ring-offset-1 ring-current`
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}>
                  {l.level}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 문제 목록 (개별) */}
        {mode === 'individual' && (
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-sm text-gray-400">불러오는 중...</div>
            ) : displayList.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-sm text-gray-400">검색 결과가 없습니다.</div>
            ) : displayList.map(q => {
              const info = getDiffInfo(q.difficulty)
              const isSel = selected?.id === q.id
              const qTimeSec = q.time_limit ?? DEFAULT_TIME_LIMITS[q.question_subtype ?? ''] ?? 30
              return (
                <button key={q.id}
                  onClick={() => setSelected(isSel ? null : q)}
                  className={`w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-xl border-2 transition ${
                    isSel ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-white hover:border-blue-200'
                  }`}>
                  <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${isSel ? 'bg-blue-600' : 'bg-gray-200'}`}>
                    {isSel && <Check size={10} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${info.color}`}>
                          {info.level}·{info.label}
                        </span>
                        {q.subcategory && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700"># {q.subcategory}</span>
                        )}
                        {q.question_subtype && (
                          <span className="text-[10px] text-gray-400">
                            {(subtypeMap[q.question_subtype] ?? q.question_subtype.replace(/_/g, ' ')).replace(/ ★NEW.*/, '')}
                          </span>
                        )}
                        {q.audio_url && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700">🎧</span>}
                      </div>
                      <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 flex-shrink-0 whitespace-nowrap">
                        <Clock size={9} /> {formatSeconds(qTimeSec)}
                      </span>
                    </div>
                    {q.summary ? (
                      <p className="text-xs text-gray-800 font-medium line-clamp-2 leading-snug">{q.summary}</p>
                    ) : (
                      <p className="text-xs text-gray-700 line-clamp-2 leading-snug">{q.content}</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* 세트 목록 */}
        {mode === 'set' && (
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2 min-h-0">
            {setsLoading ? (
              <div className="flex items-center justify-center h-32 text-sm text-gray-400">불러오는 중...</div>
            ) : displaySets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-sm text-gray-400 gap-1">
                <Layers size={24} className="text-gray-300" />
                <span>문제 세트가 없습니다.</span>
                <span className="text-xs text-gray-300">AI 문제 생성 → 지문당 문제 개수를 2개 이상 설정하면 세트가 만들어집니다</span>
              </div>
            ) : displaySets.map(s => {
              const info = getDiffInfo(s.difficulty)
              const isSel = selectedSet?.passage_group_id === s.passage_group_id
              const passagePreview = s.passage.replace(/\n/g, ' ').slice(0, 100)
              const setTotalSec = s.questions.reduce((sum, q) => {
                return sum + (q.time_limit ?? DEFAULT_TIME_LIMITS[q.question_subtype ?? ''] ?? 30)
              }, 0)
              return (
                <button key={s.passage_group_id}
                  onClick={() => setSelectedSet(isSel ? null : s)}
                  className={`w-full text-left flex items-start gap-3 px-3 py-3 rounded-xl border-2 transition ${
                    isSel ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 bg-white hover:border-indigo-200'
                  }`}>
                  <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${isSel ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                    {isSel && <Check size={10} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* 배지 */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${info.color}`}>
                          {info.level}·{info.label}
                        </span>
                        {s.question_subtype && (
                          <span className="text-[10px] text-gray-400">
                            {(subtypeMap[s.question_subtype] ?? s.question_subtype.replace(/_/g, ' ')).replace(/ ★NEW.*/, '')}
                          </span>
                        )}
                        <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                          <Layers size={9} /> {s.questions.length}문제 세트
                        </span>
                      </div>
                      <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 flex-shrink-0 whitespace-nowrap">
                        <Clock size={9} /> {formatSeconds(setTotalSec)}
                      </span>
                    </div>
                    {/* 지문 미리보기 */}
                    <p className="text-xs text-gray-500 italic line-clamp-2 mb-1.5">
                      {passagePreview}{passagePreview.length >= 100 ? '…' : ''}
                    </p>
                    {/* 문제 목록 */}
                    <ul className="space-y-0.5">
                      {s.questions.map((q, qi) => (
                        <li key={q.id} className="text-[11px] text-gray-600 flex gap-1.5 items-start">
                          <span className="text-gray-300 font-bold flex-shrink-0">{qi + 1}.</span>
                          <span className="line-clamp-1">{q.content}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* 하단: 페이지네이션 + 확인 */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          {mode === 'individual' ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition">
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-gray-500 font-medium">{page} / {Math.max(1, totalPages)}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition">
                <ChevronRight size={14} />
              </button>
              <span className="text-xs text-gray-400 ml-1">총 {total}개</span>
            </div>
          ) : (
            <div className="text-xs text-gray-400">
              {displaySets.length}개 세트 · 세트 선택 시 여러 슬롯이 한번에 채워집니다
            </div>
          )}

          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 transition">
              취소
            </button>
            {mode === 'individual' ? (
              <button
                onClick={() => { if (selected) { onSelect(selected); onClose() } }}
                disabled={!selected}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white transition">
                이 문제로 채우기
              </button>
            ) : (
              <button
                onClick={() => { if (selectedSet && onSelectSet) { onSelectSet(selectedSet.questions); onClose() } }}
                disabled={!selectedSet}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-200 text-white transition flex items-center gap-1.5">
                <Layers size={13} />
                {selectedSet
                  ? `이 세트 채우기 (${selectedSet.questions.length}문제)`
                  : '세트 선택 후 채우기'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
