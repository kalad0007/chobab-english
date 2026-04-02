import { Lock } from 'lucide-react'
import Link from 'next/link'
import type { PlanTier } from '@/lib/plan-guard'

const PLAN_NAMES: Record<PlanTier, string> = {
  free: 'FREE', lite: 'LITE', standard: 'STANDARD', pro: 'PRO', premium: 'PREMIUM',
}

const PLAN_COLORS: Record<PlanTier, string> = {
  free: 'bg-gray-100 text-gray-600',
  lite: 'bg-blue-100 text-blue-700',
  standard: 'bg-teal-100 text-teal-700',
  pro: 'bg-purple-100 text-purple-700',
  premium: 'bg-amber-100 text-amber-700',
}

interface Props {
  feature: string
  currentPlan: PlanTier
  requiredPlan: PlanTier
}

export default function UpgradeWall({ feature, currentPlan, requiredPlan }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Lock size={28} className="text-gray-400" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">{feature}</h2>
      <p className="text-gray-500 mb-1 text-sm">
        이 기능은{' '}
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${PLAN_COLORS[requiredPlan]}`}>
          {PLAN_NAMES[requiredPlan]}
        </span>{' '}
        플랜부터 사용할 수 있습니다.
      </p>
      <p className="text-gray-400 text-xs mb-6">
        현재 플랜:{' '}
        <span className={`inline-block px-2 py-0.5 rounded-full font-bold ${PLAN_COLORS[currentPlan]}`}>
          {PLAN_NAMES[currentPlan]}
        </span>
      </p>
      <Link
        href="/teacher/plan"
        className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition"
      >
        플랜 업그레이드
      </Link>
    </div>
  )
}
