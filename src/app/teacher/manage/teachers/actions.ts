'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateTeacherPlan(teacherId: string, plan: string) {
  const user = await getUserFromCookie()
  if (!user) throw new Error('Unauthorized')
  const supabase2 = await createClient()
  const { data: caller } = await supabase2.from('profiles').select('role').eq('id', user.id).single()
  if (caller?.role !== 'admin' && caller?.role !== 'superadmin') throw new Error('Forbidden')

  const supabase = createAdminClient()
  await supabase
    .from('profiles')
    .update({ plan })
    .eq('id', teacherId)
  revalidatePath('/teacher/manage/teachers')
}

export async function toggleTeacherApproval(teacherId: string, approved: boolean) {
  const user = await getUserFromCookie()
  if (!user) throw new Error('Unauthorized')
  const supabase2 = await createClient()
  const { data: caller } = await supabase2.from('profiles').select('role').eq('id', user.id).single()
  if (caller?.role !== 'admin' && caller?.role !== 'superadmin') throw new Error('Forbidden')

  const supabase = createAdminClient()
  await supabase
    .from('profiles')
    .update({ approved })
    .eq('id', teacherId)
  revalidatePath('/teacher/manage/teachers')
}

export async function addCredits(teacherId: string, amount: number) {
  const user = await getUserFromCookie()
  if (!user) throw new Error('Unauthorized')
  const supabase2 = await createClient()
  const { data: caller } = await supabase2.from('profiles').select('role').eq('id', user.id).single()
  if (caller?.role !== 'admin' && caller?.role !== 'superadmin') throw new Error('Forbidden')

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', teacherId)
    .single()
  await supabase
    .from('profiles')
    .update({ credits: (data?.credits ?? 0) + amount })
    .eq('id', teacherId)
  revalidatePath('/teacher/manage/teachers')
}
