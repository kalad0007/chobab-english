import { notFound } from 'next/navigation'
import { createClient, createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import DeploymentClient from './DeploymentClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function DeploymentDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return null

  const admin = createAdminClient()

  // 배포 기본 정보
  const { data: dep } = await admin
    .from('exam_deployments')
    .select('id, exam_id, class_id, start_at, end_at, time_limit_mins, status')
    .eq('id', id)
    .single()
  if (!dep) return notFound()

  // 시험 소유권 + 제목 확인
  const { data: exam } = await admin
    .from('exams')
    .select('id, title, teacher_id')
    .eq('id', dep.exam_id)
    .single()
  if (!exam || exam.teacher_id !== user.id) return notFound()

  // 반 이름
  const { data: cls } = await admin
    .from('classes')
    .select('name')
    .eq('id', dep.class_id)
    .single()

  // 배포 상태 자동 계산
  const now = new Date()
  const start = new Date(dep.start_at)
  const end = new Date(dep.end_at)
  let status: string = dep.status
  if (status === 'scheduled' && start <= now) status = 'active'
  if (status === 'active' && end < now) status = 'grading'

  // 반 학생 목록
  const { data: members } = await supabase
    .from('class_members')
    .select('student_id, profiles!inner(id, name, email)')
    .eq('class_id', dep.class_id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const students = (members ?? []).map((m: any) => ({
    id: m.profiles.id,
    name: m.profiles.name,
    email: m.profiles.email,
  }))

  // 제출 현황
  const studentIds = students.map((s: { id: string }) => s.id)
  const { data: submissions } = studentIds.length > 0
    ? await supabase
        .from('submissions')
        .select('student_id, submitted_at, score, total_points, percentage, status')
        .eq('deployment_id', id)
        .in('student_id', studentIds)
    : { data: [] }

  return (
    <DeploymentClient
      deploymentId={id}
      examId={dep.exam_id}
      examTitle={exam.title}
      className={cls?.name ?? ''}
      startAt={dep.start_at}
      endAt={dep.end_at}
      timeLimitMins={dep.time_limit_mins}
      status={status}
      students={students}
      submissions={(submissions ?? []).map((s: any) => ({
        student_id: s.student_id,
        submitted_at: s.submitted_at,
        score: s.score,
        total_points: s.total_points,
        percentage: s.percentage,
        status: s.status,
      }))}
    />
  )
}
