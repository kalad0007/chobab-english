'use server'

import { createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getCustomTopics() {
  const user = await getUserFromCookie()
  if (!user) return []
  const admin = createAdminClient()
  const { data } = await admin
    .from('vocab_topics')
    .select('id, value, label, emoji')
    .eq('teacher_id', user.id)
    .order('created_at')
  return (data ?? []) as { id: string; value: string; label: string; emoji: string }[]
}

export async function addCustomTopic(input: { value: string; label: string; emoji: string }) {
  const user = await getUserFromCookie()
  if (!user) return { error: '로그인 필요' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('vocab_topics')
    .insert({ teacher_id: user.id, ...input })
  if (error) return { error: error.message }
  revalidatePath('/teacher/vocab')
  return { success: true }
}

export async function deleteCustomTopic(id: string) {
  const user = await getUserFromCookie()
  if (!user) return { error: '로그인 필요' }
  const admin = createAdminClient()
  await admin.from('vocab_topics').delete().eq('id', id).eq('teacher_id', user.id)
  revalidatePath('/teacher/vocab')
  return { success: true }
}
