'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS, DIFFICULTY_LEVELS, QUESTION_SUBTYPE_LABELS, getDiffInfo, DEFAULT_TIME_LIMITS, formatSeconds } from '@/lib/utils'
import { Search, Check, X, Clock, BookOpen, ChevronDown, ChevronUp, Trophy } from 'lucide-react'

const CATEGORY_COLORS: Record<string, string> = {
  reading:   'bg-blue-100 text-blue-700',
  listening: 'bg-emerald-100 text-emerald-700',
  speaking:  'bg-orange-100 text-orange-700',
  writing:   'bg-purple-100 text-purple-700',
}

interface Question {
  id: string
  content: string
  category: string
  difficulty: number
  type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: any[] | null
  answer: string
  subcategory: string | null
  summary: string | null
  question_subtype: string | null
  source: string
  created_at: string
  passage_group_id: string | null
}

interface Class {
  id: string
  name: string
}

export default function NewExamPage() {
  const router = useRouter()
  const supabase = createClient()

  const [title, setTitle] = useState('')
  const [classId, setClassId] = useState('')
  const [timeLimit, setTimeLimit] = useState(50)
  const [showResult, setShowResult] = useState(true)
  const [classes, setClasses] = useState<Class[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [subtypeFilter, setSubtypeFilter] = useState('')
  const [maxBand, setMaxBand] = useState(5.5)   // 이 시험의 최고 밴드
  const [saving, setSaving] = useState(false)
  const [showQBank, setShowQBank] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: cls }, { data: qs }] = await Promise.all([
        supabase.from('classes').select('id, name').eq('teacher_id', user.id),
        supabase.from('questions')
          .select('id, content, category, difficulty, type, options, answer, subcategory, summary, question_subtype, source, created_at, passage_group_id')
          .eq('teacher_id', user.id).eq('is_active', true).order('created_at', { ascending: false }),
      ])
      setClasses(cls ?? [])
      setQuestions(qs ?? [])
    }
    load()
  }, [])

  const availableSubtypes = catFilter === 'all' ? [] :
    Object.entries(QUESTION_SUBTYPE_LABELS[catFilter] ?? {})
      .filter(([k]) => questions.some(q => q.category === catFilter && q.question_subtype === k))
      .map(([k, v]) => ({ value: k, label: v }))

  const filtered = questions.filter(q => {
    const matchCat = catFilter === 'all' || q.category === catFilter
    const matchSubtype = !subtypeFilter || q.question_subtype === subtypeFilter
    const s = search.toLowerCase()
    const matchSearch = !s || q.content.toLowerCase().includes(s)
      || (q.summary ?? '').toLowerCase().includes(s)
      || (q.subcategory ?? '').toLowerCase().includes(s)
    return matchCat && matchSubtype && matchSearch
  })

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function save(status: 'draft' | 'published') {
    if (!title.trim()) return alert('시험 제목을 입력해주세요')
    if (!classId) return alert('대상 반을 선택해주세요')
    if (selected.size === 0) return alert('문제를 1개 이상 선택해주세요')

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: exam, error } = await supabase.from('exams').insert({
      teacher_id: user.id,
      class_id: classId || null,
      title: title.trim(),
      time_limit: timeLimit,
      show_result_immediately: showResult,
      description: JSON.stringify({ maxBand }),
      status,
    }).select('id').single()

    if (error || !exam) {
      alert('저장 실패: ' + error?.message)
      setSaving(false)
      return
    }

    const examQuestions = Array.from(selected).map((qId, i) => ({
      exam_id: exam.id,
      question_id: qId,
      order_num: i + 1,
      points: 5,
    }))

    await supabase.from('exam_questions').insert(examQuestions)
    router.push(`/teacher/exams/${exam.id}`)
  }

  const selectedQuestions = questions.filter(q => selected.has(q.id))
  // 문제당 제한시간 합산 (subtype 기본값 → fallback 30초)
  const totalEstimatedSeconds = selectedQuestions.reduce((acc, q) => {
    return acc + (DEFAULT_TIME_LIMITS[q.question_subtype ?? ''] ?? 30)
  }, 0)

  return (
    <div className="p-4 md:p-7 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">📝 새 시험 만들기</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 왼쪽: 기본 설정 */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-gray-900 text-sm">기본 설정</h2>

            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">시험 제목 *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="예) 3월 모의고사 1회"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">대상 반 *</label>
              <select
                value={classId}
                onChange={e => setClassId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">반 선택</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block flex items-center gap-1">
                <Clock size={12} /> 제한 시간 (분)
              </label>
              <input
                type="number"
                min={5}
                max={180}
                value={timeLimit}
                onChange={e => setTimeLimit(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setShowResult(!showResult)}
                className={`w-10 h-5 rounded-full transition-colors ${showResult ? 'bg-blue-500' : 'bg-gray-200'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full mt-0.5 transition-transform shadow ${showResult ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-gray-700">제출 즉시 결과 공개</span>
            </label>

            {/* 최고 밴드 설정 */}
            <div>
              <label className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1.5">
                <Trophy size={12} className="text-orange-500" />
                이 시험의 최고 Band
                <span className={`ml-auto font-extrabold text-xs px-2 py-0.5 rounded-full ${getDiffInfo(maxBand).color}`}>
                  {getDiffInfo(maxBand).cefr} {getDiffInfo(maxBand).label} {getDiffInfo(maxBand).name}
                </span>
              </label>
              <p className="text-[11px] text-gray-400 mb-2">
                만점 받아도 이 밴드를 초과할 수 없습니다
              </p>
              <div className="flex flex-wrap gap-1">
                {DIFFICULTY_LEVELS.map(l => (
                  <button key={l.value} onClick={() => setMaxBand(l.value)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                      maxBand === l.value
                        ? `${l.color} ring-2 ring-offset-1`
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}>
                    {l.cefr}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 선택된 문제 요약 */}
          <div className="bg-blue-50 rounded-2xl border border-blue-100 p-5">
            <h2 className="font-bold text-blue-900 text-sm mb-3">선택된 문제 ({selected.size}개)</h2>
            {selectedQuestions.length === 0 ? (
              <p className="text-xs text-blue-400">문제를 선택하세요</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {selectedQuestions.map((q, i) => (
                  <div key={q.id} className="flex items-start gap-2 text-xs text-blue-800">
                    <span className="font-bold flex-shrink-0 text-blue-400">{i + 1}.</span>
                    <span className="line-clamp-2">{q.summary || q.content}</span>
                    <button onClick={() => toggle(q.id)} className="flex-shrink-0 ml-auto text-blue-300 hover:text-blue-600">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-blue-200 space-y-1">
              <div className="text-xs text-blue-600 font-semibold">
                총점: {selected.size * 5}점 ({selected.size}문제 × 5점)
              </div>
              {selected.size > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-blue-500">
                  <Clock size={11} />
                  예상 소요 시간: <span className="font-bold text-blue-700">{formatSeconds(totalEstimatedSeconds)}</span>
                </div>
              )}
            </div>
          </div>

          {/* 저장 버튼 */}
          <div className="space-y-2">
            <button
              onClick={() => save('published')}
              disabled={saving}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold transition"
            >
              {saving ? '저장 중...' : '🚀 배포하기'}
            </button>
            <button
              onClick={() => save('draft')}
              disabled={saving}
              className="w-full py-2.5 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-60 text-gray-700 rounded-xl text-sm font-semibold transition"
            >
              초안으로 저장
            </button>
          </div>
        </div>

        {/* 오른쪽: 문제 선택 */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div
              className="px-5 py-4 border-b border-gray-100 flex items-center justify-between cursor-pointer"
              onClick={() => setShowQBank(!showQBank)}
            >
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <BookOpen size={16} /> 문제은행에서 선택
                <span className="text-xs font-normal text-gray-400">({questions.length}개)</span>
              </h2>
              {showQBank ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </div>

            {showQBank && (
              <>
                {/* 필터 */}
                <div className="px-5 py-3 border-b border-gray-50 space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                      <input
                        value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') setSearch(searchInput) }}
                        placeholder="문제 검색..."
                        className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      onClick={() => setSearch(searchInput)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition flex-shrink-0"
                    >
                      검색
                    </button>
                    <select
                      value={catFilter}
                      onChange={e => { setCatFilter(e.target.value); setSubtypeFilter('') }}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-shrink-0"
                    >
                      <option value="all">전체 영역</option>
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  {catFilter !== 'all' && availableSubtypes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setSubtypeFilter('')}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition ${!subtypeFilter ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >
                        전체
                      </button>
                      {availableSubtypes.map(st => (
                        <button
                          key={st.value}
                          onClick={() => setSubtypeFilter(subtypeFilter === st.value ? '' : st.value)}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold transition ${subtypeFilter === st.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 문제 목록 */}
                <div className="divide-y divide-gray-50 max-h-[520px] overflow-y-auto">
                  {filtered.length === 0 ? (
                    <p className="text-center py-10 text-sm text-gray-400">문제가 없어요</p>
                  ) : (
                    filtered.map(q => {
                      const isSelected = selected.has(q.id)
                      const diff = getDiffInfo(q.difficulty)
                      return (
                        <div
                          key={q.id}
                          onClick={() => toggle(q.id)}
                          className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition ${isSelected ? 'bg-blue-50 border-l-2 border-blue-400' : 'hover:bg-gray-50 border-l-2 border-transparent'}`}
                        >
                          <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition ${isSelected ? 'bg-blue-600' : 'border-2 border-gray-200'}`}>
                            {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[q.category] ?? 'bg-gray-100 text-gray-600'}`}>
                                {CATEGORY_LABELS[q.category] ?? q.category}
                              </span>
                              {q.question_subtype && QUESTION_SUBTYPE_LABELS[q.category]?.[q.question_subtype] && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                  {QUESTION_SUBTYPE_LABELS[q.category][q.question_subtype]}
                                </span>
                              )}
                              {q.subcategory && (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                  # {q.subcategory}
                                </span>
                              )}
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${diff.color}`}>
                                {diff.cefr} {diff.label}
                              </span>
                              {q.source === 'ai_generated' && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600">AI</span>
                              )}
                            </div>
                            {q.summary ? (
                              <p className="text-sm text-gray-800 line-clamp-2">{q.summary}</p>
                            ) : (
                              <p className="text-sm text-gray-600 line-clamp-2">{q.content}</p>
                            )}
                            <p className="text-xs text-gray-300 mt-0.5">
                              {new Date(q.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
