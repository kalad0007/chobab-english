'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { insertCreditLog } from '@/lib/plan-guard'

/** caller의 role과 id를 반환. admin/superadmin이 아니면 에러 throw */
async function verifyAdminCaller() {
  const user = await getUserFromCookie()
  if (!user) throw new Error('Unauthorized')
  const supabase = await createClient()
  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (caller?.role !== 'admin' && caller?.role !== 'superadmin') throw new Error('Forbidden')
  return { callerId: user.id, callerRole: caller.role as 'admin' | 'superadmin' }
}

/** admin이 다른 admin 소속 선생님을 수정하지 못하도록 검증 */
async function verifyTeacherOwnership(callerId: string, callerRole: 'admin' | 'superadmin', teacherId: string) {
  if (callerRole === 'superadmin') return // superadmin은 모두 허용
  const supabase = createAdminClient()
  const { data: teacher } = await supabase
    .from('profiles')
    .select('managed_by')
    .eq('id', teacherId)
    .single()
  if (teacher?.managed_by !== callerId) throw new Error('Forbidden: 해당 선생님의 소속 원장님이 아닙니다.')
}

export async function updateTeacherPlan(teacherId: string, plan: string) {
  const { callerId, callerRole } = await verifyAdminCaller()
  await verifyTeacherOwnership(callerId, callerRole, teacherId)

  const supabase = createAdminClient()
  await supabase
    .from('profiles')
    .update({ plan })
    .eq('id', teacherId)
  revalidatePath('/teacher/manage/teachers')
}

export async function toggleTeacherApproval(teacherId: string, approved: boolean) {
  const { callerId, callerRole } = await verifyAdminCaller()
  await verifyTeacherOwnership(callerId, callerRole, teacherId)

  const supabase = createAdminClient()
  await supabase
    .from('profiles')
    .update({ approved })
    .eq('id', teacherId)
  revalidatePath('/teacher/manage/teachers')
}

export async function addCredits(teacherId: string, amount: number): Promise<{ error?: string }> {
  const { callerId, callerRole } = await verifyAdminCaller()
  await verifyTeacherOwnership(callerId, callerRole, teacherId)

  const supabase = createAdminClient()

  // superadmin은 차감 없이 기존 방식(생성)으로 처리
  if (callerRole === 'superadmin') {
    const { data: teacherRow } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', teacherId)
      .single()
    await supabase
      .from('profiles')
      .update({ credits: (teacherRow?.credits ?? 0) + amount })
      .eq('id', teacherId)

    // 슈퍼어드민 → 강사 직접 충전 로그
    await insertCreditLog({
      userId: teacherId,
      amount,
      type: 'charge',
      description: '슈퍼어드민 충전',
      supabase,
    })

    revalidatePath('/teacher/manage/teachers')
    return {}
  }

  // admin은 본인 크레딧에서 차감 후 teacher에게 이전
  const { data: adminRow } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', callerId)
    .single()
  const adminCredits = adminRow?.credits ?? 0
  if (adminCredits < amount) {
    return { error: `크레딧이 부족합니다. 잔여: ${adminCredits}` }
  }

  const { data: teacherRow } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', teacherId)
    .single()

  // admin 차감
  await supabase
    .from('profiles')
    .update({ credits: adminCredits - amount })
    .eq('id', callerId)

  // teacher 증가
  await supabase
    .from('profiles')
    .update({ credits: (teacherRow?.credits ?? 0) + amount })
    .eq('id', teacherId)

  // admin 이전 로그 (transfer_out)
  await insertCreditLog({
    userId: callerId,
    amount: -amount,
    type: 'transfer_out',
    description: '강사에게 이전',
    relatedUserId: teacherId,
    supabase,
  })

  // teacher 수신 로그 (transfer_in)
  await insertCreditLog({
    userId: teacherId,
    amount,
    type: 'transfer_in',
    description: '원장님으로부터 수신',
    relatedUserId: callerId,
    supabase,
  })

  revalidatePath('/teacher/manage/teachers')
  return {}
}

export async function withdrawCredits(teacherId: string, amount: number): Promise<{ error?: string }> {
  const { callerId, callerRole } = await verifyAdminCaller()
  await verifyTeacherOwnership(callerId, callerRole, teacherId)

  const supabase = createAdminClient()

  const { data: teacherRow } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', teacherId)
    .single()

  const teacherCredits = teacherRow?.credits ?? 0
  if (teacherCredits < amount) {
    return { error: `선생님 크레딧이 부족합니다. 잔여: ${teacherCredits}` }
  }

  // teacher 크레딧 차감
  await supabase
    .from('profiles')
    .update({ credits: teacherCredits - amount })
    .eq('id', teacherId)

  if (callerRole === 'superadmin') {
    // superadmin: teacher 크레딧 차감만 (usage 로그)
    await insertCreditLog({
      userId: teacherId,
      amount: -amount,
      type: 'usage',
      description: '슈퍼어드민 회수',
      supabase,
    })
  } else {
    // admin: teacher 차감 + admin 증가
    const { data: adminRow } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', callerId)
      .single()

    await supabase
      .from('profiles')
      .update({ credits: (adminRow?.credits ?? 0) + amount })
      .eq('id', callerId)

    // teacher 로그 (transfer_out)
    await insertCreditLog({
      userId: teacherId,
      amount: -amount,
      type: 'transfer_out',
      description: '원장님에게 반환',
      relatedUserId: callerId,
      supabase,
    })

    // admin 로그 (transfer_in)
    await insertCreditLog({
      userId: callerId,
      amount,
      type: 'transfer_in',
      description: '강사로부터 회수',
      relatedUserId: teacherId,
      supabase,
    })
  }

  revalidatePath('/teacher/manage/teachers')
  return {}
}
