'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateTeacherPlan(teacherId: string, plan: string) {
  const supabase = createAdminClient()
  await supabase
    .from('profiles')
    .update({ plan })
    .eq('id', teacherId)
  revalidatePath('/admin/teachers')
}

export async function toggleTeacherApproval(teacherId: string, approved: boolean) {
  const supabase = createAdminClient()
  await supabase
    .from('profiles')
    .update({ approved })
    .eq('id', teacherId)
  revalidatePath('/admin/teachers')
}

export async function addCredits(teacherId: string, amount: number) {
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
  revalidatePath('/admin/teachers')
}
