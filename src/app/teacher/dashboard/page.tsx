import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import Link from 'next/link'
import { QUESTION_SUBTYPE_LABELS } from '@/lib/utils'
import { Sparkles, Plus, Users, FileText, AlertCircle, CheckCircle2, Clock, Mic, PenTool, ChevronRight } from 'lucide-react'

const BAND_STEPS = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0]

function bandColor(band: number): string {
  if (band >= 5.0) return 'bg-purple-500'
  if (band >= 4.0) return 'bg-blue-500'
  if (band >= 3.0) return 'bg-teal-500'
  if (band >= 2.0) return 'bg-amber-400'
  return 'bg-red-400'
}

function bandTextColor(band: number): string {
  if (band >= 5.0) return 'text-purple-700'
  if (band >= 4.0) return 'text-blue-700'
  if (band >= 3.0) return 'text-teal-700'
  if (band >= 2.0) return 'text-amber-700'
  return 'text-red-600'
}

export default async function TeacherDashboard() {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single()

  // 내 반 목록
  const { data: classes } = await supabase
    .from('classes').select('id, name').eq('teacher_id', user.id).order('created_at', { ascending: true })

  const classIds = (classes ?? []).map(c => c.id)

  // 총 학생 수
  const { count: studentCount } = classIds.length > 0
    ? await supabase.from('class_members').select('*', { count: 'exact', head: true }).in('class_id', classIds)
    : { count: 0 }

  // 내 시험 목록
  const { data: myExams } = await supabase
    .from('exams')
    .select('id, title, status, class_id')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false })

  const examIds = (myExams ?? []).map(e => e.id)

  // 제출 데이터 (누적 수 + 평균 밴드 + 진행중 시험용)
  const { data: submissions } = examIds.length > 0
    ? await supabase
        .from('submissions')
        .select('id, exam_id, student_id, status, overall_band, profiles:student_id(name)')
        .in('exam_id', examIds)
        .in('status', ['submitted', 'graded'])
    : { data: [] }

  const submissionCount = (submissions ?? []).length

  // 평균 밴드 (graded + overall_band 있는 것만)
  const bandedSubs = (submissions ?? []).filter(s => s.status === 'graded' && s.overall_band && s.overall_band > 0)
  const avgBand = bandedSubs.length > 0
    ? Math.round((bandedSubs.reduce((s, b) => s + (b.overall_band ?? 0), 0) / bandedSubs.length) * 10) / 10
    : null

  // 채점 대기 수 (Writing + Speaking) - grading page와 동일한 패턴
  const { data: pendingAllAnswers } = examIds.length > 0
    ? await supabase
        .from('submission_answers')
        .select(`
          id,
          questions!inner(type, category, question_subtype),
          submissions!inner(exam_id, exams(teacher_id))
        `)
        .is('is_correct', null)
    : { data: [] }

  const AUTO_GRADED_SUBTYPES = ['sentence_reordering', 'complete_the_words', 'sentence_completion']

  // 내 시험 답안만 필터링
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const myPendingAnswers = (pendingAllAnswers ?? []).filter(a => (a.submissions as any)?.exams?.teacher_id === user.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingWritingCount = myPendingAnswers.filter(a => { const q = (a.questions as any); return q?.category !== 'speaking' && (q?.type === 'essay' || q?.type === 'short_answer') && !AUTO_GRADED_SUBTYPES.includes(q?.question_subtype) }).length
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingSpeakingCount = myPendingAnswers.filter(a => (a.questions as any)?.category === 'speaking').length
  const totalPending = pendingWritingCount + pendingSpeakingCount

  // 진행 중인 시험 (published)
  const publishedExams = (myExams ?? []).filter(e => e.status === 'published')

  // 각 published 시험의 class_members (미응시 명단용)
  const publishedClassIds = [...new Set(publishedExams.map(e => e.class_id).filter(Boolean))]
  const { data: allMembers } = publishedClassIds.length > 0
    ? await supabase
        .from('class_members')
        .select('student_id, class_id, profiles:student_id(name)')
        .in('class_id', publishedClassIds)
    : { data: [] }

  // exam_id → submitted student_ids
  const submittedByExam: Record<string, Set<string>> = {}
  for (const sub of submissions ?? []) {
    if (!submittedByExam[sub.exam_id]) submittedByExam[sub.exam_id] = new Set()
    submittedByExam[sub.exam_id].add(sub.student_id)
  }

  // 반별 밴드 분포 (graded submissions)
  const classBandMap: Record<string, number[]> = {}
  for (const cls of classes ?? []) {
    classBandMap[cls.id] = []
  }
  for (const sub of bandedSubs) {
    const exam = (myExams ?? []).find(e => e.id === sub.exam_id)
    if (exam?.class_id && classBandMap[exam.class_id] !== undefined) {
      classBandMap[exam.class_id].push(sub.overall_band ?? 0)
    }
  }

  // 취약 유형 TOP 3 (오답 많은 subtype)
  const { data: wrongAnswers } = examIds.length > 0
    ? await supabase
        .from('submission_answers')
        .select('questions!inner(category, sub_type), submissions!inner(exam_id, exams(teacher_id))')
        .eq('is_correct', false)
        .limit(500)
    : { data: [] }

  const subtypeWrongCount: Record<string, { category: string; count: number }> = {}
  for (const wa of wrongAnswers ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub = wa.submissions as any
    if (sub?.exams?.teacher_id !== user.id) continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = wa.questions as any
    if (!q?.sub_type || !q?.category) continue
    const key = `${q.category}::${q.sub_type}`
    if (!subtypeWrongCount[key]) subtypeWrongCount[key] = { category: q.category, count: 0 }
    subtypeWrongCount[key].count++
  }
  const weakTypes = Object.entries(subtypeWrongCount)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([key, v]) => {
      const [category, subtype] = key.split('::')
      const label = QUESTION_SUBTYPE_LABELS[category]?.[subtype] ?? subtype
      return { category, subtype, label, count: v.count }
    })

  const categoryColor: Record<string, string> = {
    reading: 'bg-blue-100 text-blue-700',
    listening: 'bg-amber-100 text-amber-700',
    speaking: 'bg-rose-100 text-rose-700',
    writing: 'bg-purple-100 text-purple-700',
  }

  return (
    <div className="p-4 md:p-7">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row md:items-start justify-between mb-7 gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-gray-900">
            안녕하세요, {profile?.name ?? '선생님'}샘! 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">오늘도 좋은 수업 되세요.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/teacher/questions/generate"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition"
          >
            <Sparkles size={15} /> AI 문제 생성
          </Link>
          <Link
            href="/teacher/exams/new"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition"
          >
            <Plus size={15} /> 모의고사 만들기
          </Link>
        </div>
      </div>

      {/* ── 1. Quick Stats ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 border-t-[3px] border-t-blue-500 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">총 학생</p>
              <p className="text-3xl font-extrabold text-gray-900 mt-1">{studentCount ?? 0}</p>
              <p className="text-xs text-gray-500 mt-0.5">{(classes ?? []).length}개 반</p>
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600">
              <Users size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 border-t-[3px] border-t-green-500 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">누적 응시</p>
              <p className="text-3xl font-extrabold text-gray-900 mt-1">{submissionCount}</p>
              <p className="text-xs text-gray-500 mt-0.5">전체 모의고사</p>
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-50 text-green-600">
              <FileText size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 border-t-[3px] border-t-amber-500 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">평균 밴드</p>
              <p className="text-3xl font-extrabold text-gray-900 mt-1">
                {avgBand !== null ? avgBand.toFixed(1) : '—'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">채점 완료 기준</p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${avgBand !== null ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-400'}`}>
              <span className="text-lg font-black">B</span>
            </div>
          </div>
        </div>

        <Link href="/teacher/grading" className={`rounded-2xl p-5 border border-t-[3px] shadow-sm transition hover:shadow-md ${totalPending > 0 ? 'bg-red-50 border-red-100 border-t-red-500' : 'bg-white border-gray-100 border-t-gray-300'}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-xs font-bold uppercase tracking-wide ${totalPending > 0 ? 'text-red-400' : 'text-gray-400'}`}>채점 대기</p>
              <p className={`text-3xl font-extrabold mt-1 ${totalPending > 0 ? 'text-red-600' : 'text-gray-900'}`}>{totalPending}</p>
              <p className={`text-xs mt-0.5 ${totalPending > 0 ? 'text-red-400' : 'text-gray-500'}`}>W {pendingWritingCount} · S {pendingSpeakingCount}</p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${totalPending > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-50 text-gray-400'}`}>
              <AlertCircle size={20} />
            </div>
          </div>
        </Link>
      </div>

      {/* ── 2 + 3. 채점 센터 + 진행 중 시험 현황 ─────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">

        {/* 채점 센터 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900">✏️ 채점 센터</h2>
            <Link href="/teacher/grading" className="text-xs text-blue-600 hover:underline font-medium flex items-center gap-0.5">
              전체 보기 <ChevronRight size={12} />
            </Link>
          </div>

          <div className="flex-1 divide-y divide-gray-50">
            {totalPending === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-5">
                <CheckCircle2 size={36} className="text-gray-200 mb-3" />
                <p className="font-semibold text-gray-500 text-sm">채점 대기 없음</p>
                <p className="text-xs text-gray-400 mt-1">모든 답안이 채점됐어요</p>
              </div>
            ) : (
              <>
                {pendingSpeakingCount > 0 && (
                  <Link href="/teacher/grading" className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <Mic size={15} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">Speaking 채점 대기</p>
                      <p className="text-xs text-gray-400 mt-0.5">답안 {pendingSpeakingCount}건</p>
                    </div>
                    <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {pendingSpeakingCount}
                    </span>
                  </Link>
                )}
                {pendingWritingCount > 0 && (
                  <Link href="/teacher/grading" className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition">
                    <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <PenTool size={15} className="text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">Writing 채점 대기</p>
                      <p className="text-xs text-gray-400 mt-0.5">답안 {pendingWritingCount}건</p>
                    </div>
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {pendingWritingCount}
                    </span>
                  </Link>
                )}
              </>
            )}
          </div>
        </div>

        {/* 진행 중 시험 현황 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900">📋 진행 중인 시험</h2>
            <Link href="/teacher/exams" className="text-xs text-blue-600 hover:underline font-medium flex items-center gap-0.5">
              전체 보기 <ChevronRight size={12} />
            </Link>
          </div>

          <div className="flex-1 divide-y divide-gray-50 overflow-auto max-h-72">
            {publishedExams.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-5">
                <Clock size={36} className="text-gray-200 mb-3" />
                <p className="font-semibold text-gray-500 text-sm">진행 중인 시험 없음</p>
              </div>
            ) : (
              publishedExams.slice(0, 5).map(exam => {
                const classMembers = (allMembers ?? []).filter(m => m.class_id === exam.class_id)
                const submitted = submittedByExam[exam.id] ?? new Set()
                const doneCount = classMembers.filter(m => submitted.has(m.student_id)).length
                const totalCount = classMembers.length
                const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0
                const notDone = classMembers.filter(m => !submitted.has(m.student_id))

                return (
                  <div key={exam.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-semibold text-gray-800 truncate flex-1 mr-2">{exam.title}</p>
                      <span className="text-xs font-bold text-gray-500 flex-shrink-0">{doneCount}/{totalCount}명</span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 bg-gray-100 rounded-full mb-2">
                      <div
                        className={`h-1.5 rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {/* 미응시 명단 */}
                    {notDone.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {notDone.slice(0, 5).map(m => (
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          <span key={m.student_id} className="text-[11px] bg-orange-50 text-orange-600 font-medium px-1.5 py-0.5 rounded">
                            {(m.profiles as any)?.name ?? '?'}
                          </span>
                        ))}
                        {notDone.length > 5 && (
                          <span className="text-[11px] text-gray-400 px-1 py-0.5">+{notDone.length - 5}명</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* ── 4 + 5. 반별 밴드 분포 + 취약 유형 TOP 3 ───────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* 반별 밴드 분포도 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900">📊 반별 밴드 분포</h2>
            <Link href="/teacher/students" className="text-xs text-blue-600 hover:underline font-medium flex items-center gap-0.5">
              학생 관리 <ChevronRight size={12} />
            </Link>
          </div>

          <div className="p-5">
            {(classes ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">반이 없어요</p>
            ) : (
              <div className="space-y-5">
                {(classes ?? []).map(cls => {
                  const bands = classBandMap[cls.id] ?? []
                  if (bands.length === 0) {
                    return (
                      <div key={cls.id}>
                        <p className="text-sm font-bold text-gray-700 mb-1.5">{cls.name}</p>
                        <p className="text-xs text-gray-400">채점 완료 데이터 없음</p>
                      </div>
                    )
                  }
                  // Build histogram
                  const buckets: Record<string, number> = {}
                  BAND_STEPS.forEach(b => { buckets[b.toFixed(1)] = 0 })
                  for (const b of bands) {
                    const snapped = (Math.round(b * 2) / 2).toFixed(1)
                    if (buckets[snapped] !== undefined) buckets[snapped]++
                  }
                  const maxCount = Math.max(...Object.values(buckets), 1)
                  const avgB = Math.round((bands.reduce((a, b) => a + b, 0) / bands.length) * 10) / 10

                  return (
                    <div key={cls.id}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-bold text-gray-700">{cls.name}</p>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${bandTextColor(avgB)} bg-gray-100`}>
                          평균 {avgB.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex items-end gap-0.5 h-12">
                        {BAND_STEPS.map(step => {
                          const count = buckets[step.toFixed(1)] ?? 0
                          const height = count > 0 ? Math.max(6, Math.round((count / maxCount) * 44)) : 2
                          return (
                            <div key={step} className="flex-1 flex flex-col items-center gap-0.5" title={`Band ${step.toFixed(1)}: ${count}명`}>
                              <div
                                className={`w-full rounded-t-sm transition-all ${count > 0 ? bandColor(step) : 'bg-gray-100'}`}
                                style={{ height: `${height}px` }}
                              />
                            </div>
                          )
                        })}
                      </div>
                      <div className="flex justify-between mt-1 px-0.5">
                        <span className="text-[10px] text-gray-400">1.0</span>
                        <span className="text-[10px] text-gray-400">3.0</span>
                        <span className="text-[10px] text-gray-400">6.0</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* 취약 유형 TOP 3 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900">🎯 취약 문제 유형 TOP 3</h2>
            <Link href="/teacher/analytics" className="text-xs text-blue-600 hover:underline font-medium flex items-center gap-0.5">
              상세 분석 <ChevronRight size={12} />
            </Link>
          </div>

          <div className="p-5">
            {weakTypes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 size={36} className="text-gray-200 mb-3" />
                <p className="font-semibold text-gray-500 text-sm">오답 데이터가 없어요</p>
                <p className="text-xs text-gray-400 mt-1">시험을 채점하면 취약 유형이 표시돼요</p>
              </div>
            ) : (
              <div className="space-y-4">
                {weakTypes.map(({ category, label, count }, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-black flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${categoryColor[category] ?? 'bg-gray-100 text-gray-600'}`}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </span>
                        <span className="text-sm font-semibold text-gray-800 truncate">{label}</span>
                      </div>
                      <p className="text-xs text-gray-400">{count}번 오답</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-black text-red-500">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
