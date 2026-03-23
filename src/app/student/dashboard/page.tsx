import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import Link from 'next/link'
import { CATEGORY_LABELS, xpToLevel, levelTitle } from '@/lib/utils'
import { FileText, RefreshCw, BookOpen, Flame, Star } from 'lucide-react'

export default async function StudentDashboard() {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single()

  // 게임화 정보
  const { data: gamif } = await supabase
    .from('student_gamification')
    .select('*')
    .eq('student_id', user.id)
    .single()

  // 영역별 실력
  const { data: skillStats } = await supabase
    .from('student_skill_stats')
    .select('*')
    .eq('student_id', user.id)
    .order('accuracy', { ascending: true })

  // 오답 복습 대기
  const { count: reviewCount } = await supabase
    .from('wrong_answer_queue')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', user.id)
    .eq('mastered', false)
    .lte('next_review_at', new Date().toISOString())

  // 배정된 시험 & 제출 완료 목록 병렬 조회
  const [classMemberships, completedSubmissions] = await Promise.all([
    supabase.from('class_members').select('class_id').eq('student_id', user.id),
    supabase.from('submissions').select('exam_id').eq('student_id', user.id).in('status', ['submitted', 'graded']),
  ])

  const classIds = (classMemberships.data ?? []).map(m => m.class_id)
  const submittedIds = (completedSubmissions.data ?? []).map(s => s.exam_id)

  let pendingExamsQuery = classIds.length > 0
    ? supabase
        .from('exams')
        .select('id, title, end_at, time_limit')
        .in('class_id', classIds)
        .eq('status', 'published')
        .order('end_at', { ascending: true })
        .limit(3)
    : null

  if (pendingExamsQuery && submittedIds.length > 0) {
    pendingExamsQuery = pendingExamsQuery.not('id', 'in', `(${submittedIds.join(',')})`)
  }

  const { data: pendingExams } = pendingExamsQuery
    ? await pendingExamsQuery
    : { data: [] }

  // 최근 시험 성적
  const { data: recentSubmissions } = await supabase
    .from('submissions')
    .select('id, score, total_points, percentage, submitted_at, exams(title)')
    .eq('student_id', user.id)
    .eq('status', 'graded')
    .order('submitted_at', { ascending: false })
    .limit(3)

  const xp = gamif?.xp ?? 0
  const level = gamif?.level ?? xpToLevel(xp)
  const streak = gamif?.streak_days ?? 0
  const xpForCurrentLevel = (level - 1) * (level - 1) * 100
  const xpForNextLevel = level * level * 100
  const xpProgress = xpForNextLevel > xpForCurrentLevel
    ? Math.round(((xp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100)
    : 100

  const weakCategory = skillStats?.find(s => s.accuracy < 70)

  return (
    <div className="p-4 md:p-7">
      <div className="mb-6 pt-2 md:pt-0">
        <h1 className="text-xl md:text-2xl font-extrabold text-gray-900">안녕하세요, {profile?.name ?? '학생'}! 👋</h1>
        <p className="text-gray-500 text-sm mt-1">오늘도 열심히 공부해봐요!</p>
      </div>

      {/* XP / 레벨 바 */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl p-5 mb-6 flex items-center gap-5">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center font-black text-xl text-white shadow-lg flex-shrink-0">
          {level}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-white font-bold">Lv.{level} {levelTitle(level)}</h3>
          </div>
          <p className="text-slate-400 text-xs mb-2">다음 레벨까지 {xpForNextLevel - xp} XP 남았어요</p>
          <div className="bg-white/10 rounded-full h-2">
            <div className="bg-gradient-to-r from-amber-400 to-yellow-300 h-2 rounded-full transition-all" style={{ width: `${xpProgress}%` }} />
          </div>
        </div>
        <div className="flex gap-5 flex-shrink-0">
          <div className="text-center">
            <div className="text-2xl"><Flame size={24} className="text-orange-400 mx-auto" /></div>
            <div className="text-white font-black text-lg">{streak}</div>
            <div className="text-slate-400 text-xs">연속 학습</div>
          </div>
          <div className="text-center">
            <div className="text-2xl"><Star size={24} className="text-yellow-400 mx-auto" /></div>
            <div className="text-white font-black text-lg">{xp.toLocaleString()}</div>
            <div className="text-slate-400 text-xs">총 XP</div>
          </div>
        </div>
      </div>

      {/* 액션 카드 3개 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Link href="/student/exams"
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl p-4 flex flex-col items-center gap-2 text-center transition">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <FileText size={20} />
          </div>
          <div>
            <p className="font-bold text-sm">시험 보기</p>
            <p className="text-blue-200 text-xs mt-0.5">{(pendingExams ?? []).length}개 대기 중</p>
          </div>
        </Link>
        <Link href="/student/review"
          className="bg-purple-600 hover:bg-purple-700 text-white rounded-2xl p-4 flex flex-col items-center gap-2 text-center transition">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <RefreshCw size={20} />
          </div>
          <div>
            <p className="font-bold text-sm">오답 복습</p>
            <p className="text-purple-200 text-xs mt-0.5">{reviewCount ?? 0}개 복습 필요</p>
          </div>
        </Link>
        <Link href="/student/learn"
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl p-4 flex flex-col items-center gap-2 text-center transition">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <BookOpen size={20} />
          </div>
          <div>
            <p className="font-bold text-sm">학습 자료</p>
            <p className="text-emerald-200 text-xs mt-0.5">자료 보기</p>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 영역별 실력 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">📊 영역별 실력</h2>
            <Link href="/student/results" className="text-xs text-blue-600 hover:underline">상세 보기</Link>
          </div>
          <div className="px-5 py-4 space-y-3.5">
            {(skillStats ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">아직 풀은 문제가 없어요</p>
            ) : (
              Object.keys(CATEGORY_LABELS).map(cat => {
                const stat = skillStats?.find(s => s.category === cat)
                const accuracy = stat ? stat.accuracy : 0
                const hasData = !!stat
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="w-14 text-sm font-semibold text-gray-700 flex-shrink-0">
                      {CATEGORY_LABELS[cat]}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all ${
                          !hasData ? 'bg-gray-200' :
                          accuracy >= 80 ? 'bg-emerald-500' :
                          accuracy >= 60 ? 'bg-blue-500' :
                          accuracy >= 40 ? 'bg-amber-400' : 'bg-red-400'
                        }`}
                        style={{ width: `${accuracy}%` }}
                      />
                    </div>
                    <span className={`w-9 text-right text-sm font-bold flex-shrink-0 ${
                      !hasData ? 'text-gray-300' :
                      accuracy >= 80 ? 'text-emerald-600' :
                      accuracy >= 60 ? 'text-blue-600' :
                      accuracy >= 40 ? 'text-amber-600' : 'text-red-500'
                    }`}>
                      {hasData ? `${Math.round(accuracy)}%` : '—'}
                    </span>
                  </div>
                )
              })
            )}
            {weakCategory && (
              <div className="mt-3 bg-amber-50 rounded-xl px-4 py-3 border-l-3 border-amber-400">
                <p className="text-sm text-amber-800 font-semibold">
                  💡 {CATEGORY_LABELS[weakCategory.category]} 영역이 취약해요!
                </p>
                <p className="text-xs text-amber-600 mt-1">오답 복습으로 실력을 키워보세요 →</p>
              </div>
            )}
          </div>
        </div>

        {/* 예정된 시험 + 최근 성적 */}
        <div className="space-y-4">
          {/* 예정 시험 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">📝 예정된 시험</h2>
              <Link href="/student/exams" className="text-xs text-blue-600 hover:underline">전체 보기</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {(pendingExams ?? []).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">예정된 시험이 없어요</p>
              ) : (
                (pendingExams ?? []).map(exam => (
                  <Link key={exam.id} href={`/student/exams/${exam.id}`}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{exam.title}</p>
                      {exam.time_limit && <p className="text-xs text-gray-400 mt-0.5">제한시간 {exam.time_limit}분</p>}
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2.5 py-1 rounded-full">응시하기 →</span>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* 최근 성적 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">🏆 최근 성적</h2>
              <Link href="/student/results" className="text-xs text-blue-600 hover:underline">전체 보기</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {(recentSubmissions ?? []).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">아직 채점된 시험이 없어요</p>
              ) : (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (recentSubmissions ?? []).map((sub: any) => (
                  <div key={sub.id} className="flex items-center justify-between px-5 py-3.5">
                    <p className="text-sm font-semibold text-gray-800">{sub.exams?.title}</p>
                    <span className={`text-sm font-black ${
                      sub.percentage >= 80 ? 'text-emerald-600' :
                      sub.percentage >= 60 ? 'text-blue-600' : 'text-amber-600'
                    }`}>
                      {sub.score}/{sub.total_points}점
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
