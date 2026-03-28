'use server'

import { createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateFeatureLevel(
  classId: string,
  studentId: string,
  featureLevel: number
): Promise<{ error?: string }> {
  const user = await getUserFromCookie()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  // 해당 반의 선생님인지 확인
  const { data: cls } = await admin
    .from('classes')
    .select('teacher_id')
    .eq('id', classId)
    .single()

  if (!cls || cls.teacher_id !== user.id) return { error: '권한이 없습니다.' }

  const { error } = await admin
    .from('class_members')
    .update({ feature_level: featureLevel })
    .eq('class_id', classId)
    .eq('student_id', studentId)

  if (error) return { error: '업데이트에 실패했습니다.' }

  revalidatePath('/teacher/classes')
  return {}
}
