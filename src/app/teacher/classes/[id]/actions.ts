'use server'

import { createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function verifyTeacher(classId: string) {
  const user = await getUserFromCookie()
  if (!user) return null
  const admin = createAdminClient()
  const { data: cls } = await admin.from('classes').select('teacher_id').eq('id', classId).single()
  if (!cls || cls.teacher_id !== user.id) return null
  return admin
}

export async function bulkRemoveStudents(
  classId: string,
  studentIds: string[]
): Promise<{ error?: string }> {
  const admin = await verifyTeacher(classId)
  if (!admin) return { error: '권한이 없습니다.' }

  const { error } = await admin
    .from('class_members')
    .delete()
    .eq('class_id', classId)
    .in('student_id', studentIds)

  if (error) return { error: '제외에 실패했습니다.' }

  revalidatePath('/teacher/classes')
  revalidatePath(`/teacher/classes/${classId}`)
  revalidatePath('/teacher/students')
  return {}
}

export async function moveStudentsToClass(
  fromClassId: string,
  toClassId: string,
  studentIds: string[]
): Promise<{ error?: string }> {
  const admin = await verifyTeacher(fromClassId)
  if (!admin) return { error: '권한이 없습니다.' }

  const { data: toClass } = await admin.from('classes').select('teacher_id').eq('id', toClassId).single()
  const user = await getUserFromCookie()
  if (!toClass || toClass.teacher_id !== user!.id) return { error: '권한이 없습니다.' }

  const { data: existing } = await admin
    .from('class_members')
    .select('student_id, feature_level, joined_at')
    .eq('class_id', fromClassId)
    .in('student_id', studentIds)

  if (!existing?.length) return {}

  const { error: delErr } = await admin
    .from('class_members')
    .delete()
    .eq('class_id', fromClassId)
    .in('student_id', studentIds)

  if (delErr) return { error: '이동에 실패했습니다.' }

  const { error: insErr } = await admin
    .from('class_members')
    .upsert(existing.map(m => ({ class_id: toClassId, student_id: m.student_id, feature_level: m.feature_level, joined_at: m.joined_at })))

  if (insErr) return { error: '이동에 실패했습니다.' }

  revalidatePath('/teacher/classes')
  revalidatePath(`/teacher/classes/${fromClassId}`)
  revalidatePath(`/teacher/classes/${toClassId}`)
  revalidatePath('/teacher/students')
  return {}
}
