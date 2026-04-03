import { createClient } from '@/lib/supabase/server'

const PLAN_TIERS = ['free', 'standard', 'pro', 'premium'] as const

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-gray-100 text-gray-600',
  standard: 'bg-blue-100 text-blue-700',
  pro: 'bg-purple-100 text-purple-700',
  premium: 'bg-amber-100 text-amber-700',
}

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  const { data: teachers } = await supabase
    .from('profiles')
    .select('plan, credits, credits_reset_at')
    .eq('role', 'teacher')

  const totalTeachers = teachers?.length ?? 0

  const planCounts = PLAN_TIERS.reduce<Record<string, number>>((acc, tier) => {
    acc[tier] = teachers?.filter((t) => t.plan === tier).length ?? 0
    return acc
  }, {})

  // 전체 크레딧 사용량 (이번 달 기준: 초기 크레딧 - 현재 잔액)
  const now = new Date()
  const totalCreditsUsed = teachers?.reduce((sum, t) => {
    const resetAt = t.credits_reset_at ? new Date(t.credits_reset_at) : new Date(0)
    const isSameMonth =
      resetAt.getMonth() === now.getMonth() && resetAt.getFullYear() === now.getFullYear()
    // 리셋 안 된 건 사용량 계산 불가
    return sum + (isSameMonth ? Math.max(0, 0) : 0) // TODO: 초기값 저장 후 차이 계산
  }, 0) ?? 0

  const totalCreditsRemaining = teachers?.reduce((sum, t) => sum + (t.credits ?? 0), 0) ?? 0

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900">관리자 대시보드</h1>
        <p className="text-sm text-gray-400 mt-1">
          {now.getFullYear()}년 {now.getMonth() + 1}월 기준
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
        <StatCard label="전체 선생님" value={totalTeachers} unit="명" color="text-gray-900" />
        <StatCard
          label="전체 잔여 크레딧"
          value={totalCreditsRemaining}
          unit="cr"
          color="text-purple-700"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-base font-bold text-gray-800 mb-5">플랜별 선생님 수</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {PLAN_TIERS.map((tier) => (
            <div key={tier} className="flex flex-col items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${PLAN_COLORS[tier]}`}
              >
                {tier}
              </span>
              <span className="text-2xl font-extrabold text-gray-900">
                {planCounts[tier]}
              </span>
              <span className="text-xs text-gray-400">명</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  unit,
  color,
}: {
  label: string
  value: number
  unit: string
  color: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <p className="text-xs text-gray-400 mb-2">{label}</p>
      <p className={`text-3xl font-extrabold ${color}`}>
        {value.toLocaleString()}
        <span className="text-base font-medium ml-1 text-gray-400">{unit}</span>
      </p>
    </div>
  )
}
