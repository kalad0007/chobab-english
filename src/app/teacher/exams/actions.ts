'use server'

import { createClient, createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 배포가 현재 선생님 소유인지 확인 (admin client 사용으로 RLS 우회)
async function assertDeploymentOwner(deploymentId: string, teacherId: string) {
  const admin = createAdminClient()
  const { data: dep } = await admin
    .from('exam_deployments')
    .select('id, exam_id')
    .eq('id', deploymentId)
    .single()
  if (!dep) throw new Error('Deployment not found')

  const { data: exam } = await admin
    .from('exams')
    .select('id')
    .eq('id', dep.exam_id)
    .eq('teacher_id', teacherId)
    .single()
  if (!exam) throw new Error('Unauthorized')

  return dep
}

export async function deployExam(formData: {
  examId: string
  classId: string
  startAt: string
  endAt: string
  timeLimitMins: number | null
}) {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) throw new Error('Unauthorized')

  // 시험 소유권 확인 (RLS로 teacher_id 자동 필터)
  const { data: exam } = await supabase
    .from('exams')
    .select('id')
    .eq('id', formData.examId)
    .eq('teacher_id', user.id)
    .single()
  if (!exam) throw new Error('Exam not found')

  const now = new Date()
  const startAt = new Date(formData.startAt)
  const status = startAt <= now ? 'active' : 'scheduled'

  const admin = createAdminClient()
  const { error } = await admin.from('exam_deployments').upsert({
    exam_id: formData.examId,
    class_id: formData.classId,
    start_at: formData.startAt,
    end_at: formData.endAt,
    time_limit_mins: formData.timeLimitMins,
    status,
  }, { onConflict: 'exam_id,class_id' })

  if (error) throw new Error(error.message)
  revalidatePath('/teacher/exams')
}

export async function updateDeploymentStatus(
  deploymentId: string,
  status: 'completed'
) {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) throw new Error('Unauthorized')

  await assertDeploymentOwner(deploymentId, user.id)

  const { error } = await supabase
    .from('exam_deployments')
    .update({
      status,
      published_at: status === 'completed' ? new Date().toISOString() : null,
    })
    .eq('id', deploymentId)

  if (error) throw new Error(error.message)
  revalidatePath('/teacher/exams')
  revalidatePath(`/teacher/deployments/${deploymentId}`)
}

export async function deleteExam(examId: string) {
  const user = await getUserFromCookie()
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()
  // 본인 소유 초안만 삭제 가능
  const { data: exam } = await admin
    .from('exams')
    .select('id, status')
    .eq('id', examId)
    .eq('teacher_id', user.id)
    .single()
  if (!exam) throw new Error('Not found')
  if (exam.status !== 'draft') throw new Error('초안만 삭제할 수 있습니다')
  // exam_questions 먼저 삭제 (FK)
  await admin.from('exam_questions').delete().eq('exam_id', examId)
  const { error } = await admin.from('exams').delete().eq('id', examId)
  if (error) throw new Error(error.message)
  revalidatePath('/teacher/exams')
}

export async function deleteDeployment(deploymentId: string) {
  const user = await getUserFromCookie()
  if (!user) throw new Error('Unauthorized')

  await assertDeploymentOwner(deploymentId, user.id)

  const admin = createAdminClient()

  // submissions → submission_answers는 cascade로 처리되므로 submissions만 먼저 삭제
  const { error: subError } = await admin
    .from('submissions')
    .delete()
    .eq('deployment_id', deploymentId)
  if (subError) throw new Error(subError.message)

  const supabase = await createClient()
  const { error } = await supabase
    .from('exam_deployments')
    .delete()
    .eq('id', deploymentId)

  if (error) throw new Error(error.message)
  revalidatePath('/teacher/exams')
}

export async function sendEncouragement(deploymentId: string, studentIds: string[]) {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()
  const { data: dep } = await admin
    .from('exam_deployments')
    .select('id, exam_id')
    .eq('id', deploymentId)
    .single()
  if (!dep) throw new Error('Deployment not found')

  const { data: exam } = await admin
    .from('exams')
    .select('title')
    .eq('id', dep.exam_id)
    .single()
  const examTitle = exam?.title ?? '시험'

  const notifications = studentIds.map(studentId => ({
    recipient_id: studentId,
    type: 'encouragement' as const,
    channel: 'in_app' as const,
    message: `📢 아직 "${examTitle}" 시험을 응시하지 않으셨습니다. 마감 전에 꼭 응시해 주세요!`,
    exam_deployment_id: deploymentId,
  }))

  const { error } = await supabase.from('notifications').insert(notifications)
  if (error) throw new Error(error.message)
}
