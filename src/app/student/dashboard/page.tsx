import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  CATEGORY_LABELS,
  accuracyToBand, bandToLevel, mapToOldToeflScore,
  xpToLevel, levelTitle,
} from '@/lib/utils'
import { FileText, RefreshCw, BookOpen, Flame, Star, Headphones, Mic, PenTool } from 'lucide-react'

const SECTION_ICONS: Record<string, typeof BookOpen> = {
  reading: BookOpen, listening: Headphones, speaking: Mic, writing: PenTool,
}
const SECTION_COLORS: Record<string, { bg: string; text: string; bar: string; light: string }> = {
  reading:   { bg: 'bg-blue-500',    text: 'text-blue-600',    bar: 'bg-blue-500',    light: 'bg-blue-50'    },
  listening: { bg: 'bg-emerald-500', text: 'text-emerald-600', bar: 'bg-emerald-500', light: 'bg-emerald-50' },
  speaking:  { bg: 'bg-orange-500',  text: 'text-orange-600',  bar: 'bg-orange-500',  light: 'bg-orange-50'  },
  writing:   { bg: 'bg-purple-500',  text: 'text-purple-600',  bar: 'bg-purple-500',  light: 'bg-purple-50'  },
}

export default async function StudentDashboard() {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles').select('name').eq('id', user.id).single()

  const { data: gamif } = await supabase
    .from('student_gamification').select('*').eq('student_id', user.id).single()

  const { data: skillStats } = await supabase
    .from('student_skill_stats').select('*').eq('student_id', user.id)

  const { count: reviewCount } = await supabase
    .from('wrong_answer_queue').select('*', { count: 'exact', head: true })
    .eq('student_id', user.id).eq('mastered', false)
    .lte('next_review_at', new Date().toISOString())

  const [classMemberships, completedSubmissions] = await Promise.all([
    supabase.from('class_members').select('class_id').eq('student_id', user.id),
    supabase.from('submissions').select('exam_id').eq('student_id', user.id).in('status', ['submitted', 'graded']),
  ])

  const classIds   = (classMemberships.data ?? []).map(m => m.class_id)
  const submittedIds = (completedSubmissions.data ?? []).map(s => s.exam_id)

  let pendingExamsQuery = classIds.length > 0
    ? supabase.from('exams').select('id, title, end_at, time_limit')
        .in('class_id', classIds).eq('status', 'published')
        .order('end_at', { ascending: true }).limit(3)
    : null
  if (pendingExamsQuery && submittedIds.length > 0)
    pendingExamsQuery = pendingExamsQuery.not('id', 'in', `(${submittedIds.join(',')})`)
  const { data: pendingExams } = pendingExamsQuery ? await pendingExamsQuery : { data: [] }

  const { data: recentSubmissions } = await supabase
    .from('submissions').select('id, score, total_points, percentage, submitted_at, status, exams(title)')
    .eq('student_id', user.id).in('status', ['graded', 'submitted'])
    .order('submitted_at', { ascending: false }).limit(3)

  // XP / Level
  const xp = gamif?.xp ?? 0
  const level = gamif?.level ?? xpToLevel(xp)
  const streak = gamif?.streak_days ?? 0
  const xpForCurrentLevel = (level - 1) * (level - 1) * 100
  const xpForNextLevel    = level * level * 100
  const xpProgress = xpForNextLevel > xpForCurrentLevel
    ? Math.round(((xp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100)
    : 100

  // ── 신 토플 밴드 스코어 계산 ──────────────────────────────────────────────
  // 대시보드 개요: 정답률 → 밴드 근사치 (exactCalculation은 시험 결과 상세 페이지에서)
  const sectionBands: Record<string, number> = {}
  Object.keys(CATEGORY_LABELS).forEach(cat => {
    const stat = skillStats?.find(s => s.category === cat)
    sectionBands[cat] = stat ? accuracyToBand(stat.accuracy) : 0
  })

  const bandsWithData = Object.values(sectionBands).filter(b => b > 0)
  const totalBand = bandsWithData.length > 0
    ? Math.round((bandsWithData.reduce((a, b) => a + b, 0) / bandsWithData.length) * 2) / 2
    : 0
  const hasAnyStats = bandsWithData.length > 0
  const oldToeflEst = hasAnyStats ? mapToOldToeflScore(totalBand) : null

  return (
    <div className="p-4 md:p-7">
      <div className="mb-6 pt-2 md:pt-0">
        <h1 className="text-xl md:text-2xl font-extrabold text-gray-900">
          안녕하세요, {profile?.name ?? '학생'}! 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">신 토플 (2026~) 밴드 스코어로 실력을 확인하세요</p>
      </div>

      {/* ── 신 토플 밴드 스코어 카드 ── */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-5 mb-4">
          {/* 총 밴드 스코어 */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500
                          flex flex-col items-center justify-center flex-shrink-0 shadow-lg">
            <span className="font-black text-2xl text-white leading-none">
              {hasAnyStats ? totalBand.toFixed(1) : '—'}
            </span>
            <span className="text-white/70 text-[10px] font-semibold mt-0.5">Band</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="text-white font-bold text-lg leading-tight">신 토플 Band Score</h3>
              <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">1.0 ~ 6.0</span>
            </div>
            <p className="text-slate-300 text-sm font-semibold">
              {hasAnyStats ? bandToLevel(totalBand) : '아직 데이터가 없어요'}
            </p>
            {oldToeflEst && (
              <p className="text-slate-400 text-xs mt-1">
                구 토플 환산: <span className="text-amber-300 font-bold">{oldToeflEst}</span>
              </p>
            )}
          </div>

          <div className="flex gap-4 flex-shrink-0">
            <div className="text-center">
              <Flame size={22} className="text-orange-400 mx-auto" />
              <div className="text-white font-black text-lg">{streak}</div>
              <div className="text-slate-400 text-[10px]">연속 학습</div>
            </div>
            <div className="text-center">
              <Star size={22} className="text-yellow-400 mx-auto" />
              <div className="text-white font-black text-lg">{xp.toLocaleString()}</div>
              <div className="text-slate-400 text-[10px]">총 XP</div>
            </div>
          </div>
        </div>

        {/* 섹션별 밴드 바 */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {Object.keys(CATEGORY_LABELS).map(cat => {
            const band = sectionBands[cat]
            const pct  = band > 0 ? (band / 6.0) * 100 : 0
            const colors = SECTION_COLORS[cat]
            return (
              <div key={cat} className="text-center">
                <p className="text-white font-bold text-base">
                  {band > 0 ? band.toFixed(1) : '—'}
                </p>
                <div className="bg-white/10 rounded-full h-1.5 mt-1">
                  <div className={`${colors.bar} h-1.5 rounded-full transition-all`}
                    style={{ width: `${pct}%` }} />
                </div>
                <p className="text-slate-400 text-[10px] mt-1">{CATEGORY_LABELS[cat]}</p>
              </div>
            )
          })}
        </div>

        {/* 레벨 바 */}
        <div className="pt-3 border-t border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 flex-shrink-0">Lv.{level} {levelTitle(level)}</span>
            <div className="flex-1 bg-white/10 rounded-full h-1.5">
              <div className="bg-gradient-to-r from-amber-400 to-yellow-300 h-1.5 rounded-full transition-all"
                style={{ width: `${xpProgress}%` }} />
            </div>
            <span className="text-xs text-slate-400 flex-shrink-0">{xp}/{xpForNextLevel} XP</span>
          </div>
        </div>
      </div>

      {/* ── 섹션별 연습 카드 ── */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {Object.keys(CATEGORY_LABELS).map(cat => {
          const Icon  = SECTION_ICONS[cat]
          const colors = SECTION_COLORS[cat]
          const band  = sectionBands[cat]
          return (
            <Link key={cat} href={`/student/practice/${cat}`}
              className={`${colors.bg} hover:opacity-90 text-white rounded-2xl p-4 flex flex-col items-center gap-2 text-center transition`}>
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Icon size={20} />
              </div>
              <p className="font-bold text-sm">{CATEGORY_LABELS[cat]}</p>
              <p className="text-white/80 text-xs font-semibold">
                {band > 0 ? `Band ${band.toFixed(1)}` : '미측정'}
              </p>
            </Link>
          )
        })}
      </div>

      {/* ── 퀵 액션 ── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Link href="/student/exams"
          className="bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 rounded-xl p-3 flex items-center gap-2 transition">
          <FileText size={18} className="text-blue-600" />
          <div>
            <p className="font-bold text-xs text-gray-800">모의고사</p>
            <p className="text-[10px] text-gray-500">{(pendingExams ?? []).length}개 대기</p>
          </div>
        </Link>
        <Link href="/student/review"
          className="bg-white border border-gray-200 hover:border-purple-300 hover:bg-purple-50 rounded-xl p-3 flex items-center gap-2 transition">
          <RefreshCw size={18} className="text-purple-600" />
          <div>
            <p className="font-bold text-xs text-gray-800">오답 복습</p>
            <p className="text-[10px] text-gray-500">{reviewCount ?? 0}개 필요</p>
          </div>
        </Link>
        <Link href="/student/learn"
          className="bg-white border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 rounded-xl p-3 flex items-center gap-2 transition">
          <BookOpen size={18} className="text-emerald-600" />
          <div>
            <p className="font-bold text-xs text-gray-800">학습 자료</p>
            <p className="text-[10px] text-gray-500">TOEFL 팁</p>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* ── 섹션별 밴드 상세 ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">📊 섹션별 Band Score</h2>
            <Link href="/student/results" className="text-xs text-blue-600 hover:underline">상세 보기</Link>
          </div>
          <div className="px-5 py-4 space-y-4">
            {!hasAnyStats ? (
              <p className="text-sm text-gray-400 text-center py-4">아직 풀은 문제가 없어요</p>
            ) : (
              Object.keys(CATEGORY_LABELS).map(cat => {
                const stat   = skillStats?.find(s => s.category === cat)
                const band   = sectionBands[cat]
                const hasData = band > 0
                const colors  = SECTION_COLORS[cat]
                const Icon    = SECTION_ICONS[cat]
                const pct     = hasData ? (band / 6.0) * 100 : 0
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <div className={`w-8 h-8 ${colors.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <Icon size={14} className="text-white" />
                    </div>
                    <span className="w-20 text-sm font-semibold text-gray-700 flex-shrink-0">
                      {CATEGORY_LABELS[cat]}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                      <div className={`h-2.5 rounded-full transition-all ${!hasData ? 'bg-gray-200' : colors.bar}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                    <div className="w-24 text-right flex-shrink-0">
                      {hasData ? (
                        <>
                          <span className={`text-sm font-black ${colors.text}`}>
                            Band {band.toFixed(1)}
                          </span>
                          <span className="text-gray-400 text-xs block">
                            {stat ? `${Math.round(stat.accuracy)}% 정답` : ''}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm font-bold text-gray-300">—</span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
            {hasAnyStats && (
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">구 토플 환산 참고</span>
                <span className="text-sm font-black text-amber-600">
                  {oldToeflEst ?? '—'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── 예정된 시험 + 최근 성적 ── */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">📝 예정된 모의고사</h2>
              <Link href="/student/exams" className="text-xs text-blue-600 hover:underline">전체 보기</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {(pendingExams ?? []).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">예정된 모의고사가 없어요</p>
              ) : (
                (pendingExams ?? []).map(exam => (
                  <Link key={exam.id} href={`/student/exams/${exam.id}`}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{exam.title}</p>
                      {exam.time_limit && (
                        <p className="text-xs text-gray-400 mt-0.5">{exam.time_limit}분</p>
                      )}
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2.5 py-1 rounded-full">응시 →</span>
                  </Link>
                ))
              )}
            </div>
          </div>

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
                    {sub.status === 'graded' ? (
                      <span className={`text-sm font-black ${
                        sub.percentage >= 80 ? 'text-emerald-600' :
                        sub.percentage >= 60 ? 'text-blue-600' : 'text-amber-600'
                      }`}>
                        {sub.score}/{sub.total_points}점
                      </span>
                    ) : (
                      <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-1 rounded-full">채점 중</span>
                    )}
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
