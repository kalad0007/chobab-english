import { createClient, getUserFromCookie } from '@/lib/supabase/server'

// ──────────────────────────────────────────────
// 뱃지 정의
// ──────────────────────────────────────────────
interface BadgeDef {
  id: string
  emoji: string
  name: string
  desc: string
  check: (stats: Stats) => boolean
  progress?: (stats: Stats) => { current: number; max: number }
}

interface Stats {
  xp: number
  level: number
  streak: number
  solved: number
  correct: number
  exams: number
  avgScore: number | null
}

const BADGES: BadgeDef[] = [
  {
    id: 'first_exam',
    emoji: '📝',
    name: '첫 시험',
    desc: '첫 번째 시험에 응시했어요',
    check: s => s.exams >= 1,
  },
  {
    id: 'first_correct',
    emoji: '⭐',
    name: '첫 정답',
    desc: '처음으로 문제를 맞혔어요',
    check: s => s.correct >= 1,
  },
  {
    id: 'streak_3',
    emoji: '🔥',
    name: '3일 연속',
    desc: '3일 연속으로 공부했어요',
    check: s => s.streak >= 3,
    progress: s => ({ current: Math.min(s.streak, 3), max: 3 }),
  },
  {
    id: 'streak_7',
    emoji: '🔥🔥',
    name: '일주일 연속',
    desc: '7일 연속으로 공부했어요',
    check: s => s.streak >= 7,
    progress: s => ({ current: Math.min(s.streak, 7), max: 7 }),
  },
  {
    id: 'solved_10',
    emoji: '💪',
    name: '10문제 돌파',
    desc: '문제를 10개 이상 풀었어요',
    check: s => s.solved >= 10,
    progress: s => ({ current: Math.min(s.solved, 10), max: 10 }),
  },
  {
    id: 'solved_50',
    emoji: '🏆',
    name: '50문제 돌파',
    desc: '문제를 50개 이상 풀었어요',
    check: s => s.solved >= 50,
    progress: s => ({ current: Math.min(s.solved, 50), max: 50 }),
  },
  {
    id: 'solved_100',
    emoji: '🎖️',
    name: '100문제 달성',
    desc: '문제를 100개 이상 풀었어요',
    check: s => s.solved >= 100,
    progress: s => ({ current: Math.min(s.solved, 100), max: 100 }),
  },
  {
    id: 'accuracy_80',
    emoji: '🎯',
    name: '정확도 달인',
    desc: '정답률 80% 이상을 달성했어요',
    check: s => s.solved >= 5 && s.solved > 0 && (s.correct / s.solved) >= 0.8,
    progress: s => ({
      current: s.solved > 0 ? Math.round((s.correct / s.solved) * 100) : 0,
      max: 80,
    }),
  },
  {
    id: 'accuracy_90',
    emoji: '💎',
    name: '완벽에 가깝게',
    desc: '정답률 90% 이상을 달성했어요',
    check: s => s.solved >= 10 && s.solved > 0 && (s.correct / s.solved) >= 0.9,
    progress: s => ({
      current: s.solved > 0 ? Math.round((s.correct / s.solved) * 100) : 0,
      max: 90,
    }),
  },
  {
    id: 'xp_100',
    emoji: '✨',
    name: 'XP 100 달성',
    desc: 'XP를 100 이상 획득했어요',
    check: s => s.xp >= 100,
    progress: s => ({ current: Math.min(s.xp, 100), max: 100 }),
  },
  {
    id: 'xp_500',
    emoji: '🌟',
    name: 'XP 500 달성',
    desc: 'XP를 500 이상 획득했어요',
    check: s => s.xp >= 500,
    progress: s => ({ current: Math.min(s.xp, 500), max: 500 }),
  },
  {
    id: 'level_2',
    emoji: '🆙',
    name: 'Lv.2 달성',
    desc: '레벨 2에 도달했어요',
    check: s => s.level >= 2,
  },
  {
    id: 'level_5',
    emoji: '🚀',
    name: 'Lv.5 달성',
    desc: '레벨 5에 도달했어요',
    check: s => s.level >= 5,
    progress: s => ({ current: Math.min(s.level, 5), max: 5 }),
  },
  {
    id: 'exam_5',
    emoji: '📚',
    name: '5회 응시',
    desc: '시험을 5회 이상 응시했어요',
    check: s => s.exams >= 5,
    progress: s => ({ current: Math.min(s.exams, 5), max: 5 }),
  },
  {
    id: 'score_100',
    emoji: '💯',
    name: '만점!',
    desc: '시험에서 100점을 받았어요',
    check: s => s.avgScore !== null && s.avgScore >= 100,
  },
]

// 레벨별 필요 XP
const LEVEL_XP = [0, 100, 250, 500, 900, 1400, 2000]
function getNextLevelXP(level: number) {
  return LEVEL_XP[Math.min(level, LEVEL_XP.length - 1)] ?? 9999
}

export default async function BadgesPage() {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return null

  const [{ data: gamif }, { data: submissions }] = await Promise.all([
    supabase
      .from('student_gamification')
      .select('xp, level, streak_days, total_questions_solved, total_correct')
      .eq('student_id', user.id)
      .single(),
    supabase
      .from('submissions')
      .select('score, total_points, status')
      .eq('student_id', user.id)
      .in('status', ['submitted', 'graded']),
  ])

  const examCount = (submissions ?? []).length
  const gradedSubs = (submissions ?? []).filter(s => s.status === 'graded' && (s.total_points ?? 0) > 0)
  const avgScore = gradedSubs.length > 0
    ? Math.round(gradedSubs.reduce((sum, s) => sum + ((s.score ?? 0) / s.total_points!) * 100, 0) / gradedSubs.length)
    : null

  const stats: Stats = {
    xp: gamif?.xp ?? 0,
    level: gamif?.level ?? 1,
    streak: gamif?.streak_days ?? 0,
    solved: gamif?.total_questions_solved ?? 0,
    correct: gamif?.total_correct ?? 0,
    exams: examCount,
    avgScore,
  }

  const earned = BADGES.filter(b => b.check(stats))
  const locked = BADGES.filter(b => !b.check(stats))
  const accuracy = stats.solved > 0 ? Math.round((stats.correct / stats.solved) * 100) : 0
  const nextLevelXP = getNextLevelXP(stats.level)
  const xpProgress = Math.min(Math.round((stats.xp / nextLevelXP) * 100), 100)

  return (
    <div className="p-7 max-w-3xl">
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold text-gray-900">🏅 내 뱃지</h1>
        <p className="text-gray-500 text-sm mt-1">열심히 공부하면 뱃지를 획득할 수 있어요</p>
      </div>

      {/* 현재 스탯 */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white mb-7 shadow-lg">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-yellow-400 flex items-center justify-center text-2xl font-extrabold text-slate-900">
            {stats.level}
          </div>
          <div className="flex-1">
            <p className="text-xs text-slate-400 font-semibold">현재 레벨</p>
            <p className="text-xl font-extrabold">Lv.{stats.level}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 bg-slate-700 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-yellow-400 transition-all"
                  style={{ width: `${xpProgress}%` }}
                />
              </div>
              <span className="text-xs text-slate-400">{stats.xp} / {nextLevelXP} XP</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: '획득 뱃지', value: `${earned.length}개`, icon: '🏅' },
            { label: '연속 학습', value: `${stats.streak}일`, icon: '🔥' },
            { label: '푼 문제', value: `${stats.solved}개`, icon: '💪' },
            { label: '정답률', value: stats.solved > 0 ? `${accuracy}%` : '—', icon: '🎯' },
          ].map(item => (
            <div key={item.label} className="bg-slate-700/50 rounded-xl p-3 text-center">
              <p className="text-lg">{item.icon}</p>
              <p className="text-base font-extrabold mt-0.5">{item.value}</p>
              <p className="text-xs text-slate-400">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 획득한 뱃지 */}
      {earned.length > 0 && (
        <div className="mb-7">
          <h2 className="text-sm font-extrabold text-gray-700 mb-3">
            ✅ 획득한 뱃지 <span className="text-blue-600 ml-1">{earned.length}</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {earned.map(b => (
              <div key={b.id} className="bg-white rounded-2xl border border-yellow-200 shadow-sm p-4 flex items-start gap-3">
                <span className="text-3xl flex-shrink-0">{b.emoji}</span>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{b.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{b.desc}</p>
                  <span className="inline-block mt-1.5 text-xs font-bold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
                    획득 완료
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 잠긴 뱃지 */}
      {locked.length > 0 && (
        <div>
          <h2 className="text-sm font-extrabold text-gray-700 mb-3">
            🔒 도전 중인 뱃지 <span className="text-gray-400 ml-1">{locked.length}</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {locked.map(b => {
              const prog = b.progress?.(stats)
              const pct = prog ? Math.round((prog.current / prog.max) * 100) : 0
              return (
                <div key={b.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start gap-3 opacity-70">
                  <span className="text-3xl flex-shrink-0 grayscale">{b.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-600 text-sm">{b.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{b.desc}</p>
                    {prog && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>{prog.current}</span>
                          <span>{prog.max}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-blue-400 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
