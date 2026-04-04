import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import { Users, CreditCard, GraduationCap, FileText, AlertTriangle, TrendingUp, BarChart3, Award } from 'lucide-react'

export default async function ManageDashboardPage() {
  const supabase = await createClient()

  const user = await getUserFromCookie()
  if (!user) return null

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isSuperadmin = myProfile?.role === 'superadmin'

  // 소속 강사 목록
  let teacherQuery = supabase
    .from('profiles')
    .select('id, name, credits, plan')
    .eq('role', 'teacher')

  if (!isSuperadmin) {
    teacherQuery = teacherQuery.eq('managed_by', user.id)
  }

  const { data: teachers } = await teacherQuery

  const teacherIds = (teachers ?? []).map((t) => t.id)

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // 4주 전 기준
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString()

  // 병렬 조회
  const [classesRes, examsRes, quizzesRes, creditLogsRes, submissionsRes] = await Promise.all([
    teacherIds.length > 0
      ? supabase.from('classes').select('id, teacher_id').in('teacher_id', teacherIds)
      : Promise.resolve({ data: [] }),

    teacherIds.length > 0
      ? supabase.from('exams').select('id, teacher_id, created_at').in('teacher_id', teacherIds)
      : Promise.resolve({ data: [] }),

    teacherIds.length > 0
      ? supabase.from('collocation_quizzes').select('id, teacher_id, created_at').in('teacher_id', teacherIds)
      : Promise.resolve({ data: [] }),

    // 이번 달 크레딧 사용 로그
    teacherIds.length > 0
      ? supabase
          .from('credit_logs')
          .select('user_id, amount, type, created_at')
          .in('user_id', teacherIds)
          .eq('type', 'usage')
          .gte('created_at', monthStart)
      : Promise.resolve({ data: [] }),

    // 학생 성적 (소속 강사의 시험)
    teacherIds.length > 0
      ? supabase
          .from('submissions')
          .select('exam_id, student_id, percentage')
          .not('percentage', 'is', null)
      : Promise.resolve({ data: [] }),
  ])

  const classes = classesRes.data ?? []
  const exams = examsRes.data ?? []
  const quizzes = quizzesRes.data ?? []
  const creditLogs = creditLogsRes.data ?? []
  const allSubmissions = submissionsRes.data ?? []

  const classIds = classes.map((c) => c.id)
  const examIds = exams.map((e) => e.id)

  // 반별 학생 수
  const classMembersRes =
    classIds.length > 0
      ? await supabase.from('class_members').select('class_id, student_id').in('class_id', classIds)
      : { data: [] }

  const classMembers = classMembersRes.data ?? []

  // 소속 강사 시험의 제출만 필터
  const submissions = allSubmissions.filter((s) => examIds.includes(s.exam_id))

  // 요약 통계
  const totalTeachers = teachers?.length ?? 0
  const totalCredits = (teachers ?? []).reduce((sum, t) => sum + (t.credits ?? 0), 0)
  const totalStudents = classMembers.length
  const thisMonthExams = exams.filter((e) => e.created_at >= monthStart).length
  const thisMonthQuizzes = quizzes.filter((q) => q.created_at >= monthStart).length
  const thisMonthTotal = thisMonthExams + thisMonthQuizzes

  // ── 강사별 데이터 집계 ──
  const teacherRows = (teachers ?? []).map((teacher) => {
    const teacherClasses = classes.filter((c) => c.teacher_id === teacher.id)
    const teacherClassIds = teacherClasses.map((c) => c.id)
    const studentCount = classMembers.filter((m) => teacherClassIds.includes(m.class_id)).length
    const examCount = exams.filter((e) => e.teacher_id === teacher.id).length
    const quizCount = quizzes.filter((q) => q.teacher_id === teacher.id).length

    const teacherExams = exams.filter((e) => e.teacher_id === teacher.id)
    const teacherQuizzes = quizzes.filter((q) => q.teacher_id === teacher.id)
    const allDates = [
      ...teacherExams.map((e) => e.created_at),
      ...teacherQuizzes.map((q) => q.created_at),
    ].filter(Boolean)
    const lastActivity = allDates.length > 0 ? allDates.sort().at(-1) : null

    // 비활동 일수
    const daysSinceActivity = lastActivity
      ? Math.floor((now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
      : null

    // 크레딧 사용량 (이번 달)
    const monthlyUsage = creditLogs
      .filter((l) => l.user_id === teacher.id)
      .reduce((sum, l) => sum + Math.abs(l.amount), 0)

    // 학생 성적
    const teacherExamIds = teacherExams.map((e) => e.id)
    const teacherSubmissions = submissions.filter((s) => teacherExamIds.includes(s.exam_id))
    const scores = teacherSubmissions.map((s) => s.percentage).filter((p): p is number => p !== null)
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
    const maxScore = scores.length > 0 ? Math.max(...scores) : null
    const minScore = scores.length > 0 ? Math.min(...scores) : null

    return {
      id: teacher.id,
      name: teacher.name ?? '(이름 없음)',
      credits: teacher.credits ?? 0,
      plan: teacher.plan ?? 'free',
      studentCount,
      examCount,
      quizCount,
      lastActivity,
      daysSinceActivity,
      monthlyUsage,
      avgScore,
      maxScore,
      minScore,
      submissionCount: teacherSubmissions.length,
    }
  })

  // ── 미활동 강사 (7일 이상) ──
  const inactiveTeachers = teacherRows.filter(
    (t) => t.daysSinceActivity === null || t.daysSinceActivity >= 7
  )

  // ── 주간 활동 추이 (최근 4주) ──
  const weeklyData = Array.from({ length: 4 }, (_, i) => {
    const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000)
    const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000)
    const weekExams = exams.filter(
      (e) => e.created_at >= weekStart.toISOString() && e.created_at < weekEnd.toISOString()
    ).length
    const weekQuizzes = quizzes.filter(
      (q) => q.created_at >= weekStart.toISOString() && q.created_at < weekEnd.toISOString()
    ).length
    const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}~${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`
    return { label, exams: weekExams, quizzes: weekQuizzes, total: weekExams + weekQuizzes }
  }).reverse()

  const maxWeeklyTotal = Math.max(...weeklyData.map((w) => w.total), 1)

  // ── 강사별 크레딧 사용량 (이번 달) ──
  const creditUsageRows = teacherRows
    .filter((t) => t.monthlyUsage > 0)
    .sort((a, b) => b.monthlyUsage - a.monthlyUsage)

  const maxCreditUsage = Math.max(...creditUsageRows.map((r) => r.monthlyUsage), 1)

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-gray-900">관리자 대시보드</h1>
          <p className="text-sm text-gray-400 mt-1">
            {now.getFullYear()}년 {now.getMonth() + 1}월 기준
          </p>
        </div>

        {/* 상단 요약 카드 4개 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
          <StatCard label="전체 강사 수" value={totalTeachers} unit="명" color="text-gray-900" icon={<Users className="w-5 h-5 text-gray-400" />} />
          <StatCard label="선생님 크레딧 합계" value={totalCredits} unit="cr" color="text-purple-700" icon={<CreditCard className="w-5 h-5 text-purple-300" />} />
          <StatCard label="전체 학생 수" value={totalStudents} unit="명" color="text-blue-700" icon={<GraduationCap className="w-5 h-5 text-blue-300" />} />
          <StatCard label="이번 달 출제 수" value={thisMonthTotal} unit="건" color="text-emerald-700" icon={<FileText className="w-5 h-5 text-emerald-300" />} />
        </div>

        {/* ⚠️ 미활동 강사 알림 */}
        {inactiveTeachers.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800 mb-1">미활동 강사 알림</p>
              <div className="flex flex-wrap gap-2">
                {inactiveTeachers.map((t) => (
                  <span key={t.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                    {t.name}
                    <span className="text-amber-500">
                      {t.daysSinceActivity === null ? '활동 없음' : `${t.daysSinceActivity}일 미활동`}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 강사별 현황 테이블 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-800">강사별 현황</h2>
          </div>

          {teacherRows.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-gray-400">소속 강사가 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs text-gray-400 uppercase tracking-wide">
                    <th className="px-6 py-3 text-left font-semibold">이름</th>
                    <th className="px-4 py-3 text-right font-semibold">잔여 크레딧</th>
                    <th className="px-4 py-3 text-right font-semibold">이달 사용</th>
                    <th className="px-4 py-3 text-right font-semibold">학생 수</th>
                    <th className="px-4 py-3 text-right font-semibold">시험</th>
                    <th className="px-4 py-3 text-right font-semibold">퀴즈</th>
                    <th className="px-4 py-3 text-right font-semibold">최근 활동</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {teacherRows.map((row) => {
                    const isInactive = row.daysSinceActivity === null || row.daysSinceActivity >= 7
                    return (
                      <tr key={row.id} className={`hover:bg-slate-50 transition-colors ${isInactive ? 'bg-red-50/40' : ''}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{row.name}</span>
                            <PlanBadge plan={row.plan} />
                            {isInactive && (
                              <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" title="7일 이상 미활동" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="font-bold text-purple-700">{row.credits.toLocaleString()}</span>
                          <span className="text-gray-400 ml-1 text-xs">cr</span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="font-medium text-orange-600">{row.monthlyUsage.toLocaleString()}</span>
                          <span className="text-gray-400 ml-1 text-xs">cr</span>
                        </td>
                        <td className="px-4 py-4 text-right text-gray-700">{row.studentCount}<span className="text-gray-400 ml-1 text-xs">명</span></td>
                        <td className="px-4 py-4 text-right text-gray-700">{row.examCount}<span className="text-gray-400 ml-1 text-xs">건</span></td>
                        <td className="px-4 py-4 text-right text-gray-700">{row.quizCount}<span className="text-gray-400 ml-1 text-xs">건</span></td>
                        <td className="px-4 py-4 text-right text-xs text-gray-400">
                          {row.lastActivity
                            ? new Date(row.lastActivity).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 2열 레이아웃: 크레딧 사용 + 주간 활동 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* 이번 달 크레딧 사용 차트 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 className="w-5 h-5 text-orange-400" />
              <h2 className="text-base font-bold text-gray-800">이번 달 크레딧 사용</h2>
            </div>
            {creditUsageRows.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">사용 내역이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {creditUsageRows.map((row) => (
                  <div key={row.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700">{row.name}</span>
                      <span className="font-bold text-orange-600">{row.monthlyUsage.toLocaleString()} cr</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div
                        className="bg-orange-400 h-2.5 rounded-full transition-all"
                        style={{ width: `${(row.monthlyUsage / maxCreditUsage) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 주간 활동 추이 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <h2 className="text-base font-bold text-gray-800">주간 출제 추이 (최근 4주)</h2>
            </div>
            <div className="flex items-end gap-3 h-40">
              {weeklyData.map((week, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-bold text-gray-700">{week.total}</span>
                  <div className="w-full flex flex-col items-center gap-0.5" style={{ height: '120px' }}>
                    <div className="w-full flex flex-col justify-end h-full gap-0.5">
                      <div
                        className="w-full bg-blue-400 rounded-t transition-all"
                        style={{ height: `${(week.exams / maxWeeklyTotal) * 100}%`, minHeight: week.exams > 0 ? '4px' : '0' }}
                      />
                      <div
                        className="w-full bg-emerald-400 rounded-b transition-all"
                        style={{ height: `${(week.quizzes / maxWeeklyTotal) * 100}%`, minHeight: week.quizzes > 0 ? '4px' : '0' }}
                      />
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400 text-center leading-tight">{week.label}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-400" /> 시험</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-400" /> 퀴즈</span>
            </div>
          </div>
        </div>

        {/* 학생 성적 요약 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-gray-800">강사별 학생 성적 요약</h2>
          </div>

          {teacherRows.filter((t) => t.submissionCount > 0).length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-gray-400">성적 데이터가 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs text-gray-400 uppercase tracking-wide">
                    <th className="px-6 py-3 text-left font-semibold">강사명</th>
                    <th className="px-4 py-3 text-right font-semibold">학생 수</th>
                    <th className="px-4 py-3 text-right font-semibold">응시 건수</th>
                    <th className="px-4 py-3 text-right font-semibold">평균 점수</th>
                    <th className="px-4 py-3 text-right font-semibold">최고점</th>
                    <th className="px-4 py-3 text-right font-semibold">최저점</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {teacherRows
                    .filter((t) => t.submissionCount > 0)
                    .map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-gray-900">{row.name}</td>
                        <td className="px-4 py-4 text-right text-gray-700">{row.studentCount}<span className="text-gray-400 ml-1 text-xs">명</span></td>
                        <td className="px-4 py-4 text-right text-gray-700">{row.submissionCount}<span className="text-gray-400 ml-1 text-xs">건</span></td>
                        <td className="px-4 py-4 text-right">
                          <span className={`font-bold ${(row.avgScore ?? 0) >= 70 ? 'text-emerald-600' : (row.avgScore ?? 0) >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                            {row.avgScore ?? '—'}
                          </span>
                          <span className="text-gray-400 ml-1 text-xs">%</span>
                        </td>
                        <td className="px-4 py-4 text-right text-emerald-600 font-medium">{row.maxScore ?? '—'}<span className="text-gray-400 ml-1 text-xs">%</span></td>
                        <td className="px-4 py-4 text-right text-red-500 font-medium">{row.minScore ?? '—'}<span className="text-gray-400 ml-1 text-xs">%</span></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, unit, color, icon }: { label: string; value: number; unit: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        {icon}
      </div>
      <p className={`text-3xl font-extrabold ${color}`}>
        {value.toLocaleString()}
        <span className="text-base font-medium ml-1 text-gray-400">{unit}</span>
      </p>
    </div>
  )
}

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-gray-100 text-gray-600',
  standard: 'bg-blue-100 text-blue-700',
  pro: 'bg-purple-100 text-purple-700',
  premium: 'bg-amber-100 text-amber-700',
}

function PlanBadge({ plan }: { plan: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${PLAN_COLORS[plan] ?? PLAN_COLORS.free}`}>
      {plan}
    </span>
  )
}
