'use server'

import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateCreditCosts(updates: { id: string; cost: number }[]) {
  const user = await getUserFromCookie()
  if (!user) throw new Error('Unauthorized')

  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'superadmin') {
    throw new Error('슈퍼관리자 권한이 필요합니다.')
  }

  if (updates.length === 0) return { success: true }

  const rows = updates.map(u => ({
    id: u.id,
    cost: u.cost,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  }))

  const { error } = await supabase
    .from('credit_costs')
    .upsert(rows, { onConflict: 'id' })

  if (error) throw new Error(error.message)

  revalidatePath('/teacher/manage/credit-costs')
  return { success: true }
}
