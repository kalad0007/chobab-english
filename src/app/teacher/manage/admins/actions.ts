'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { insertCreditLog } from '@/lib/plan-guard'

async function verifySuperadmin() {
  const user = await getUserFromCookie()
  if (!user) throw new Error('Unauthorized')
  const supabase = await createClient()
  const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (caller?.role !== 'superadmin') throw new Error('Forbidden')
}

export async function updateAdminPlan(adminId: string, plan: string) {
  await verifySuperadmin()

  const supabase = createAdminClient()
  await supabase
    .from('profiles')
    .update({ plan })
    .eq('id', adminId)
  revalidatePath('/teacher/manage/admins')
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'EDU-'
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function toggleAdminApproval(adminId: string, approved: boolean): Promise<{ invite_code?: string }> {
  await verifySuperadmin()

  const supabase = createAdminClient()

  if (approved) {
    // 승인 시 invite_code가 없으면 자동 생성 (중복 없을 때까지 재시도)
    const { data: existing } = await supabase
      .from('profiles')
      .select('invite_code')
      .eq('id', adminId)
      .single()

    let inviteCode = existing?.invite_code
    if (!inviteCode) {
      // 중복 방지 루프
      let attempts = 0
      while (attempts < 10) {
        const candidate = generateInviteCode()
        const { data: conflict } = await supabase
          .from('profiles')
          .select('id')
          .eq('invite_code', candidate)
          .maybeSingle()
        if (!conflict) {
          inviteCode = candidate
          break
        }
        attempts++
      }
      await supabase
        .from('profiles')
        .update({ approved, invite_code: inviteCode })
        .eq('id', adminId)
    } else {
      await supabase
        .from('profiles')
        .update({ approved })
        .eq('id', adminId)
    }

    revalidatePath('/teacher/manage/admins')
    return { invite_code: inviteCode ?? undefined }
  }

  await supabase
    .from('profiles')
    .update({ approved })
    .eq('id', adminId)
  revalidatePath('/teacher/manage/admins')
  return {}
}

export async function addAdminCredits(adminId: string, amount: number) {
  await verifySuperadmin()

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', adminId)
    .single()
  await supabase
    .from('profiles')
    .update({ credits: (data?.credits ?? 0) + amount })
    .eq('id', adminId)

  // 크레딧 충전 로그
  await insertCreditLog({
    userId: adminId,
    amount,
    type: 'charge',
    description: '슈퍼어드민 충전',
    supabase,
  })

  revalidatePath('/teacher/manage/admins')
}
