import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import ExamsPageClient from './ExamsPageClient'
import { DEFAULT_TIME_LIMITS, AUDIO_BUFFER } from '@/lib/utils'

// adaptive 시험의 총 문제 수 계산
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calcAdaptiveCount(description: string | null): number | null {
  if (!description) return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg: any = JSON.parse(description)
    if (!cfg.adaptive) return null
    let total = 0
    total += (cfg.m1Ids ?? []).length + (cfg.m2upIds ?? []).length + (cfg.m2downIds ?? []).length
    for (const mod of [cfg.listening_m1, cfg.listening_m2up, cfg.listening_m2down]) {
      if (!mod) continue
      total += (mod.response ?? []).length
      for (const s of [...(mod.conversation ?? []), ...(mod.academicTalk ?? [])]) {
        total += (s.questionIds ?? []).length
      }
    }
    total += (cfg.writing?.reorderingIds ?? []).length + (cfg.writing?.emailIds ?? []).length
    total += (cfg.speaking?.listenRepeatIds ?? []).length + (cfg.speaking?.interviewIds ?? []).length
    return total
  } catch { return null }
}

export default async function ExamsPage() {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return null

  // 1. 초안 시험 목록
  const { data: exams } = await supabase
    .from('exams')
    .select('id, title, description, time_limit, created_at, status')
    .eq('teacher_id', user.id)
    .in('status', ['draft', 'published'])
    .order('created_at', { ascending: false })

  // 문제 수 + 시간 집계
  const examIds = (exams ?? []).map(e => e.id)
  const { data: examQs } = examIds.length > 0
    ? await supabase
        .from('exam_questions')
        .select('exam_id, questions(question_subtype, time_limit)')
        .in('exam_id', examIds)
    : { data: [] }

  const qMap: Record<string, number> = {}
  const timeMap: Record<string, number> = {}  // 초 단위
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const eq of (examQs ?? []) as any[]) {
    qMap[eq.exam_id] = (qMap[eq.exam_id] ?? 0) + 1
    const q = eq.questions
    if (q) {
      const base = q.time_limit ?? DEFAULT_TIME_LIMITS[q.question_subtype ?? ''] ?? 0
      const buffer = AUDIO_BUFFER[q.question_subtype ?? ''] ?? 0
      timeMap[eq.exam_id] = (timeMap[eq.exam_id] ?? 0) + base + buffer
    }
  }
  for (const exam of exams ?? []) {
    const adaptive = calcAdaptiveCount(exam.description)
    if (adaptive !== null) qMap[exam.id] = adaptive
  }

  const drafts = (exams ?? [])
    .filter(e => e.status === 'draft' || e.status === 'published')
    .map(e => ({
      id: e.id,
      title: e.title,
      description: e.description,
      time_limit: e.time_limit,
      created_at: e.created_at,
      qCount: qMap[e.id] ?? 0,
      calculated_time_mins: timeMap[e.id] ? Math.ceil(timeMap[e.id] / 60) : null,
    }))

  // 2. 배포 목록 (active / grading / completed)
  const { data: rawDeployments } = await supabase
    .from('exam_deployments')
    .select(`
      id, exam_id, class_id, start_at, end_at, time_limit_mins, status,
      exams!inner(title, teacher_id),
      classes!inner(name)
    `)
    .eq('exams.teacher_id', user.id)
    .order('created_at', { ascending: false })

  // 각 배포별 총 학생 수 + 제출 수 집계
  const deploymentIds = (rawDeployments ?? []).map(d => d.id)
  const classIds = [...new Set((rawDeployments ?? []).map(d => d.class_id))]

  const { data: classMembers } = classIds.length > 0
    ? await supabase.from('class_members').select('class_id, student_id').in('class_id', classIds)
    : { data: [] }

  const { data: submissions } = deploymentIds.length > 0
    ? await supabase
        .from('submissions')
        .select('deployment_id, status')
        .in('deployment_id', deploymentIds)
        .in('status', ['submitted', 'graded'])
    : { data: [] }

  const classMemberMap: Record<string, number> = {}
  for (const m of classMembers ?? []) {
    classMemberMap[m.class_id] = (classMemberMap[m.class_id] ?? 0) + 1
  }

  const submissionCountMap: Record<string, number> = {}
  for (const s of submissions ?? []) {
    if (s.deployment_id) {
      submissionCountMap[s.deployment_id] = (submissionCountMap[s.deployment_id] ?? 0) + 1
    }
  }

  // 배포 상태 자동 업데이트 (시간 기준)
  const now = new Date()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deployments = (rawDeployments ?? []).map((d: any) => {
    let status = d.status
    const end = new Date(d.end_at)
    const start = new Date(d.start_at)
    if (status === 'scheduled' && start <= now) status = 'active'
    if (status === 'active' && end < now) status = 'grading'

    return {
      id: d.id,
      exam_id: d.exam_id,
      exam_title: d.exams?.title ?? '',
      class_id: d.class_id,
      class_name: d.classes?.name ?? '',
      start_at: d.start_at,
      end_at: d.end_at,
      time_limit_mins: d.time_limit_mins,
      status,
      totalStudents: classMemberMap[d.class_id] ?? 0,
      submittedCount: submissionCountMap[d.id] ?? 0,
    }
  })

  const active    = deployments.filter(d => d.status === 'active' || d.status === 'scheduled')
  const grading   = deployments.filter(d => d.status === 'grading')
  const completed = deployments.filter(d => d.status === 'completed')

  // 3. 반 목록 (배포 모달용)
  const { data: classes } = await supabase
    .from('classes')
    .select('id, name')
    .eq('teacher_id', user.id)
    .order('name')

  return (
    <ExamsPageClient
      drafts={drafts}
      active={active}
      grading={grading}
      completed={completed}
      classes={(classes ?? []).map(c => ({ id: c.id, name: c.name }))}
    />
  )
}
