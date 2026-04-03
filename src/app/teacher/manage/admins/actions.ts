'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

export async function toggleAdminApproval(adminId: string, approved: boolean) {
  await verifySuperadmin()

  const supabase = createAdminClient()
  await supabase
    .from('profiles')
    .update({ approved })
    .eq('id', adminId)
  revalidatePath('/teacher/manage/admins')
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
  revalidatePath('/teacher/manage/admins')
}
