'use client'

import { useState, useTransition } from 'react'
import { updateAdminPlan, toggleAdminApproval, addAdminCredits } from './actions'

const PLAN_TIERS = ['free', 'standard', 'pro', 'premium'] as const
type PlanTier = typeof PLAN_TIERS[number]

const PLAN_COLORS: Record<PlanTier, string> = {
  free: 'bg-gray-100 text-gray-600',
  standard: 'bg-blue-100 text-blue-700',
  pro: 'bg-purple-100 text-purple-700',
  premium: 'bg-amber-100 text-amber-700',
}

interface Admin {
  id: string
  name: string | null
  email: string | null
  plan: PlanTier
  credits: number
  approved: boolean | null
  created_at: string
}

export default function AdminsClient({ admins: initial }: { admins: Admin[] }) {
  const [admins, setAdmins] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [creditInput, setCreditInput] = useState<Record<string, string>>({})

  function handlePlanChange(adminId: string, newPlan: PlanTier) {
    startTransition(async () => {
      await updateAdminPlan(adminId, newPlan)
      setAdmins((prev) =>
        prev.map((a) => (a.id === adminId ? { ...a, plan: newPlan } : a))
      )
    })
  }

  function handleApprovalToggle(adminId: string, currentApproved: boolean | null) {
    startTransition(async () => {
      const newApproved = !currentApproved
      await toggleAdminApproval(adminId, newApproved)
      setAdmins((prev) =>
        prev.map((a) => (a.id === adminId ? { ...a, approved: newApproved } : a))
      )
    })
  }

  function handleAddCredits(adminId: string) {
    const amount = parseInt(creditInput[adminId] ?? '0', 10)
    if (!amount || amount <= 0) return
    startTransition(async () => {
      await addAdminCredits(adminId, amount)
      setAdmins((prev) =>
        prev.map((a) => (a.id === adminId ? { ...a, credits: a.credits + amount } : a))
      )
      setCreditInput((prev) => ({ ...prev, [adminId]: '' }))
    })
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">관리자 관리</h1>
        <p className="text-sm text-gray-400 mt-1">총 {admins.length}명</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 w-36">이름</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">이메일</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 w-32">플랜</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 w-24">크레딧</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 w-40">크레딧 충전</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 w-24">승인</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 w-28">가입일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 truncate max-w-[144px]">
                    {admin.name ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 truncate max-w-[180px]">
                    {admin.email ?? '-'}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={admin.plan}
                      disabled={isPending}
                      onChange={(e) => handlePlanChange(admin.id, e.target.value as PlanTier)}
                      className={`w-full rounded-lg border border-gray-200 px-2 py-1 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-300 cursor-pointer ${PLAN_COLORS[admin.plan]}`}
                    >
                      {PLAN_TIERS.map((tier) => (
                        <option key={tier} value={tier}>
                          {tier.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-purple-700">
                    {admin.credits.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        placeholder="0"
                        value={creditInput[admin.id] ?? ''}
                        onChange={(e) => setCreditInput((prev) => ({ ...prev, [admin.id]: e.target.value }))}
                        className="w-20 px-2 py-1 border border-gray-200 rounded-lg text-xs text-center focus:outline-none focus:ring-2 focus:ring-purple-300"
                      />
                      <button
                        disabled={isPending}
                        onClick={() => handleAddCredits(admin.id)}
                        className="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-bold hover:bg-purple-200 transition disabled:opacity-50"
                      >
                        충전
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      disabled={isPending}
                      onClick={() => handleApprovalToggle(admin.id, admin.approved)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                        admin.approved
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-red-100 text-red-600 hover:bg-red-200'
                      }`}
                    >
                      {admin.approved ? '승인됨' : '미승인'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 text-xs">
                    {new Date(admin.created_at).toLocaleDateString('ko-KR')}
                  </td>
                </tr>
              ))}
              {admins.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                    등록된 관리자가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
