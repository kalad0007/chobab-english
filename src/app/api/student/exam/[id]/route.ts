import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, getUserFromCookie } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: examId } = await params
  const user = await getUserFromCookie()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // 학생이 이 시험에 접근 가능한지 확인
  const { data: classMemberships } = await admin
    .from('class_members')
    .select('class_id')
    .eq('student_id', user.id)

  const classIds = (classMemberships ?? []).map(m => m.class_id)

  const { data: deployment } = await admin
    .from('exam_deployments')
    .select('id, time_limit_mins, status')
    .eq('exam_id', examId)
    .in('class_id', classIds.length > 0 ? classIds : [''])
    .neq('status', 'completed')
    .maybeSingle()

  if (!deployment) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // 시험 정보 (description 포함)
  const { data: exam } = await admin
    .from('exams')
    .select('title, time_limit, max_band_ceiling, description')
    .eq('id', examId)
    .single()

  // exam_questions (Reading M1 등 기본 문제)
  const { data: examQRows } = await admin
    .from('exam_questions')
    .select('question_id, order_num, points')
    .eq('exam_id', examId)
    .order('order_num')

  // adaptive 시험: description JSON에서 나머지 섹션 문제 ID 추출
  let adaptiveExtraIds: string[] = []
  let isAdaptive = false
  try {
    const desc = typeof exam?.description === 'string'
      ? JSON.parse(exam.description)
      : exam?.description
    if (desc?.adaptive) {
      isAdaptive = true
      const lm1 = desc.listening_m1 ?? {}
      const writing = desc.writing ?? {}
      const speaking = desc.speaking ?? {}

      adaptiveExtraIds = [
        ...(lm1.response ?? []),
        ...(lm1.conversation ?? []).flatMap((s: { questionIds: string[] }) => s.questionIds ?? []),
        ...(lm1.academicTalk ?? []).flatMap((s: { questionIds: string[] }) => s.questionIds ?? []),
        ...(writing.reorderingIds ?? []),
        ...(writing.emailIds ?? []),
        ...(speaking.listenRepeatIds ?? []),
        ...(speaking.interviewIds ?? []),
      ].filter(Boolean)
    }
  } catch { /* description이 없거나 JSON이 아닌 경우 무시 */ }

  // 모든 question ID 수집
  const m1Ids = (examQRows ?? []).map(r => r.question_id)
  const allIds = [...new Set([...m1Ids, ...adaptiveExtraIds])]

  const { data: questions } = allIds.length > 0
    ? await admin.from('questions').select('*').in('id', allIds)
    : { data: [] }

  const questionMap = Object.fromEntries((questions ?? []).map(q => [q.id, q]))

  // exam_questions rows (reading M1)
  const m1Rows = (examQRows ?? []).map(row => ({
    question_id: row.question_id,
    order_num: row.order_num,
    points: row.points,
    questions: questionMap[row.question_id] ?? null,
  }))

  // adaptive 추가 섹션 rows (listening, writing, speaking)
  const extraRows = isAdaptive
    ? adaptiveExtraIds.map((qId, i) => ({
        question_id: qId,
        order_num: m1Rows.length + i + 1,
        points: 1,
        questions: questionMap[qId] ?? null,
      }))
    : []

  const examQuestions = [...m1Rows, ...extraRows]

  const timeLimitMins = deployment.time_limit_mins ?? exam?.time_limit ?? null

  // description은 클라이언트에 노출하지 않음
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { description: _desc, ...examWithoutDesc } = exam ?? {}

  return NextResponse.json({
    exam: { ...examWithoutDesc, time_limit: timeLimitMins },
    examQuestions,
    deploymentId: deployment.id,
  })
}
