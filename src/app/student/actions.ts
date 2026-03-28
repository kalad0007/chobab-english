'use server'

import { createClient, createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function joinClass(inviteCode: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const admin = createAdminClient()
  const user = await getUserFromCookie()
  if (!user) return { error: '로그인이 필요합니다.' }

  // RLS 우회: 모든 반의 초대코드를 조회해야 하므로 admin 클라이언트 사용
  const { data: cls, error: codeError } = await admin
    .from('classes')
    .select('id, name')
    .eq('invite_code', inviteCode.trim().toUpperCase())
    .single()

  if (codeError || !cls) return { error: '유효하지 않은 초대 코드입니다.' }

  const { error: insertError } = await supabase
    .from('class_members')
    .insert({ class_id: cls.id, student_id: user.id })

  if (insertError) {
    if (insertError.code === '23505') return { error: '이미 참여 중인 반입니다.' }
    return { error: '반 입장에 실패했습니다.' }
  }

  revalidatePath('/student/dashboard')
  return {}
}

export async function leaveClass(classId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { error } = await supabase
    .from('class_members')
    .delete()
    .eq('class_id', classId)
    .eq('student_id', user.id)

  if (error) return { error: '반 나가기에 실패했습니다.' }

  revalidatePath('/student/dashboard')
  return {}
}
