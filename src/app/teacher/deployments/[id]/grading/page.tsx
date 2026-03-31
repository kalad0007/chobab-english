import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import { ArrowLeft, Clock, Mic } from 'lucide-react'
import GradeEssayPanel from '@/app/teacher/grading/GradeEssayPanel'
import GradeSpeakingPanel from '@/app/teacher/grading/GradeSpeakingPanel'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function DeploymentGradingPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return null

  const admin = createAdminClient()

  // 배포 정보 확인
  const { data: dep } = await admin
    .from('exam_deployments')
    .select('id, exam_id')
    .eq('id', id)
    .single()
  if (!dep) return notFound()

  const { data: exam } = await admin
    .from('exams')
    .select('id, title, teacher_id')
    .eq('id', dep.exam_id)
    .single()
  if (!exam || exam.teacher_id !== user.id) return notFound()

  const examTitle: string = exam.title

  // 이 배포의 채점 대기 Writing 답안
  const { data: essayAnswers } = await supabase
    .from('submission_answers')
    .select(`
      id, student_answer, score, is_correct,
      questions!inner(content, answer, explanation, type, category),
      submissions!inner(id, exam_id, student_id, deployment_id, profiles:student_id(name), exams(title, teacher_id))
    `)
    .in('questions.type', ['essay', 'short_answer'])
    .neq('questions.category', 'speaking')
    .is('is_correct', null)
    .eq('submissions.deployment_id', id)

  // 이 배포의 채점 대기 Speaking 답안
  const { data: speakingAnswers } = await supabase
    .from('submission_answers')
    .select(`
      id, student_answer, score, is_correct,
      questions!inner(content, type, category, speaking_prompt),
      submissions!inner(id, exam_id, student_id, deployment_id, profiles:student_id(name), exams(title, teacher_id))
    `)
    .eq('questions.category', 'speaking')
    .is('is_correct', null)
    .eq('submissions.deployment_id', id)

  const essays = (essayAnswers ?? []).filter(a => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (a.submissions as any)?.exams?.teacher_id === user.id
  })

  const speaking = (speakingAnswers ?? []).filter(a => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (a.submissions as any)?.exams?.teacher_id === user.id
  })

  const total = essays.length + speaking.length

  return (
    <div className="p-4 md:p-7 max-w-4xl">
      <Link href={`/teacher/deployments/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 transition">
        <ArrowLeft size={15} /> 응시 현황으로
      </Link>

      <div className="mb-6">
        <p className="text-sm font-bold text-purple-600 mb-1">{examTitle}</p>
        <h1 className="text-2xl font-extrabold text-gray-900">✏️ 채점 관리</h1>
        <p className="text-gray-500 text-sm mt-1">
          {total > 0 ? `채점 대기 ${total}건` : '모든 채점이 완료되었어요'}
        </p>
      </div>

      {/* 스피킹 채점 대기 */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Mic size={16} className="text-amber-500" />
          <h2 className="font-bold text-gray-900">스피킹 채점 대기</h2>
          {speaking.length > 0 && (
            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{speaking.length}</span>
          )}
        </div>
        {speaking.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <Mic size={36} className="mx-auto text-gray-200 mb-3" />
            <p className="font-semibold text-gray-500">채점 대기 중인 스피킹 답안이 없어요</p>
          </div>
        ) : (
          <div className="space-y-4">
            {speaking.map(a => (
              <GradeSpeakingPanel key={a.id} answer={a} />
            ))}
          </div>
        )}
      </div>

      {/* Writing 채점 대기 */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-bold text-gray-900">Writing 채점 대기</h2>
          {essays.length > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{essays.length}</span>
          )}
        </div>
        {essays.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <Clock size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="font-semibold text-gray-500">채점 대기 중인 Writing 답안이 없어요</p>
          </div>
        ) : (
          <div className="space-y-4">
            {essays.map(a => (
              <GradeEssayPanel key={a.id} answer={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
