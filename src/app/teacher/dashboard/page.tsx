import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import Link from 'next/link'
import { CATEGORY_LABELS, formatDate } from '@/lib/utils'
import { Sparkles, Plus, Users, BookOpen, FileText, TrendingUp } from 'lucide-react'

export default async function TeacherDashboard() {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single()

  // 내 반 목록 먼저 조회 (서브쿼리 대신 두 단계로 처리)
  const { data: classes } = await supabase
    .from('classes').select('id, name, grade').eq('teacher_id', user.id)

  const classIds = (classes ?? []).map(c => c.id)

  // 통계 데이터 병렬 조회
  const [
    { count: studentCount },
    { count: questionCount },
    { count: examCount },
    { data: recentExams },
  ] = await Promise.all([
    classIds.length > 0
      ? supabase.from('class_members').select('*', { count: 'exact', head: true }).in('class_id', classIds)
      : Promise.resolve({ count: 0 }),
    supabase.from('questions').select('*', { count: 'exact', head: true }).eq('teacher_id', user.id).eq('is_active', true),
    supabase.from('exams').select('*', { count: 'exact', head: true }).eq('teacher_id', user.id),
    supabase.from('exams').select(`id, title, status, created_at, classes(name)`)
      .eq('teacher_id', user.id).order('created_at', { ascending: false }).limit(5),
  ])

  // 카테고리별 정답률 (학생 통계 집계)
  const { data: skillStats } = await supabase
    .from('student_skill_stats')
    .select('category, total_count, correct_count')
    .in(
      'student_id',
      (await supabase.from('class_members').select('student_id')
        .in('class_id', (classes ?? []).map(c => c.id))).data?.map(m => m.student_id) ?? []
    )

  const categoryAgg: Record<string, { total: number; correct: number }> = {}
  for (const stat of skillStats ?? []) {
    if (!categoryAgg[stat.category]) categoryAgg[stat.category] = { total: 0, correct: 0 }
    categoryAgg[stat.category].total += stat.total_count
    categoryAgg[stat.category].correct += stat.correct_count
  }

  const categoryAccuracy = Object.entries(categoryAgg).map(([cat, { total, correct }]) => ({
    category: cat,
    accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
    total,
  })).sort((a, b) => a.accuracy - b.accuracy)

  const statusLabel: Record<string, { text: string; className: string }> = {
    draft:     { text: '임시저장', className: 'bg-gray-100 text-gray-600' },
    published: { text: '진행 중', className: 'bg-green-100 text-green-700' },
    closed:    { text: '완료', className: 'bg-blue-100 text-blue-700' },
  }

  return (
    <div className="p-7">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">
            안녕하세요, {profile?.name ?? '선생님'}! 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">오늘도 좋은 수업 되세요.</p>
        </div>
        <div className="flex gap-2">
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
            <Plus size={15} /> 시험 만들기
          </Link>
        </div>
      </div>

      {/* 스탯 카드 */}
      <div className="grid grid-cols-4 gap-4 mb-7">
        {[
          { label: '전체 학생', value: studentCount ?? 0, sub: `${(classes ?? []).length}개 반`, icon: Users, color: 'border-blue-500', iconBg: 'bg-blue-50 text-blue-600' },
          { label: '문제 수', value: questionCount ?? 0, sub: '문제은행 등록', icon: BookOpen, color: 'border-purple-500', iconBg: 'bg-purple-50 text-purple-600' },
          { label: '시험 수', value: examCount ?? 0, sub: '전체 출제', icon: FileText, color: 'border-green-500', iconBg: 'bg-green-50 text-green-600' },
          {
            label: '평균 정답률',
            value: categoryAccuracy.length > 0
              ? `${Math.round(categoryAccuracy.reduce((s, c) => s + c.accuracy, 0) / categoryAccuracy.length)}%`
              : '—',
            sub: '전체 영역',
            icon: TrendingUp,
            color: 'border-amber-500',
            iconBg: 'bg-amber-50 text-amber-600',
          },
        ].map(card => (
          <div key={card.label} className={`bg-white rounded-2xl p-5 border border-gray-100 border-t-[3px] ${card.color} shadow-sm`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{card.label}</p>
                <p className="text-3xl font-extrabold text-gray-900 mt-1">{card.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{card.sub}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                <card.icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* 최근 시험 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900">📝 최근 시험</h2>
            <Link href="/teacher/exams" className="text-xs text-blue-600 hover:underline font-medium">전체 보기</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {(recentExams ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">아직 출제한 시험이 없어요</p>
            ) : (
              (recentExams ?? []).map(exam => {
                const status = statusLabel[exam.status] ?? statusLabel.draft
                return (
                  <Link
                    key={exam.id}
                    href={`/teacher/exams/${exam.id}`}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{exam.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(exam.classes as any)?.name ?? '반 미지정'} · {formatDate(exam.created_at)}
                      </p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${status.className}`}>
                      {status.text}
                    </span>
                  </Link>
                )
              })
            )}
          </div>
        </div>

        {/* 유형별 정답률 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900">📊 유형별 정답률</h2>
            <Link href="/teacher/analytics" className="text-xs text-blue-600 hover:underline font-medium">상세 분석</Link>
          </div>
          <div className="px-5 py-4 space-y-3.5">
            {categoryAccuracy.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">아직 통계 데이터가 없어요</p>
            ) : (
              categoryAccuracy.map(({ category, accuracy }) => (
                <div key={category} className="flex items-center gap-3">
                  <span className="w-20 text-sm font-semibold text-gray-700 flex-shrink-0">
                    {CATEGORY_LABELS[category] ?? category}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${
                        accuracy >= 80 ? 'bg-emerald-500' :
                        accuracy >= 60 ? 'bg-blue-500' :
                        accuracy >= 40 ? 'bg-amber-400' : 'bg-red-400'
                      }`}
                      style={{ width: `${accuracy}%` }}
                    />
                  </div>
                  <span className={`w-10 text-right text-sm font-bold ${
                    accuracy >= 80 ? 'text-emerald-600' :
                    accuracy >= 60 ? 'text-blue-600' :
                    accuracy >= 40 ? 'text-amber-600' : 'text-red-500'
                  }`}>
                    {accuracy}%
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 반 현황 */}
      {(classes ?? []).length > 0 && (
        <div className="mt-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900">🏫 반 현황</h2>
            <Link href="/teacher/classes" className="text-xs text-blue-600 hover:underline font-medium">반 관리</Link>
          </div>
          <div className="grid grid-cols-3 gap-4 p-5">
            {(classes ?? []).map(cls => (
              <Link
                key={cls.id}
                href={`/teacher/classes`}
                className="p-4 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition"
              >
                <p className="font-bold text-gray-900">{cls.name}</p>
                {cls.grade && <p className="text-xs text-gray-500 mt-0.5">{cls.grade}학년</p>}
              </Link>
            ))}
            <Link
              href="/teacher/classes"
              className="p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-300 flex items-center justify-center text-sm text-gray-400 hover:text-blue-500 transition"
            >
              + 반 추가
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
