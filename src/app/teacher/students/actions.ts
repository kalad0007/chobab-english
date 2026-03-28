'use server'

import { createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function removeStudentFromClass(
  classId: string,
  studentId: string
): Promise<{ error?: string }> {
  const user = await getUserFromCookie()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  const { data: cls } = await admin
    .from('classes')
    .select('teacher_id')
    .eq('id', classId)
    .single()

  if (!cls || cls.teacher_id !== user.id) return { error: '권한이 없습니다.' }

  const { error } = await admin
    .from('class_members')
    .delete()
    .eq('class_id', classId)
    .eq('student_id', studentId)

  if (error) return { error: '제외에 실패했습니다.' }

  revalidatePath('/teacher/students')
  revalidatePath('/teacher/classes')
  return {}
}
