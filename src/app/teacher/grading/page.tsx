import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import { Clock, Mic } from 'lucide-react'
import GradeEssayPanel from './GradeEssayPanel'
import GradeSpeakingPanel from './GradeSpeakingPanel'

export default async function GradingPage() {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return null

  // 채점 대기 중인 주관식(essay) 답안
  const { data: pendingAnswers } = await supabase
    .from('submission_answers')
    .select(`
      id, student_answer, score, is_correct,
      questions!inner(content, answer, explanation, type, category),
      submissions!inner(exam_id, student_id, profiles:student_id(name), exams(title, teacher_id))
    `)
    .eq('questions.type', 'essay')
    .is('is_correct', null)

  const filtered = (pendingAnswers ?? []).filter(a => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub = a.submissions as any
    return sub?.exams?.teacher_id === user.id
  })

  // 채점 대기 중인 스피킹 답안
  const { data: speakingAnswers } = await supabase
    .from('submission_answers')
    .select(`
      id, student_answer, score, is_correct,
      questions!inner(content, type, category, speaking_prompt),
      submissions!inner(id, exam_id, student_id, profiles:student_id(name), exams(title, teacher_id))
    `)
    .eq('questions.category', 'speaking')
    .is('is_correct', null)

  const filteredSpeaking = (speakingAnswers ?? []).filter(a => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub = a.submissions as any
    return sub?.exams?.teacher_id === user.id
  })

  // 최근 채점 완료 (essay, is_correct not null)
  const { data: gradedAnswers } = await supabase
    .from('submission_answers')
    .select(`
      id, student_answer, score, is_correct,
      questions!inner(content, answer, type),
      submissions!inner(student_id, profiles:student_id(name), exams(title, teacher_id))
    `)
    .eq('questions.type', 'essay')
    .not('is_correct', 'is', null)
    .order('id', { ascending: false })
    .limit(20)

  const gradedFiltered = (gradedAnswers ?? []).filter(a => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub = a.submissions as any
    return sub?.exams?.teacher_id === user.id
  })

  return (
    <div className="p-4 md:p-7">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">✏️ 채점 관리</h1>
        <p className="text-gray-500 text-sm mt-1">주관식 · 스피킹 답안 채점</p>
      </div>

      {/* 스피킹 채점 대기 */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Mic size={16} className="text-amber-500" />
          <h2 className="font-bold text-gray-900">스피킹 채점 대기</h2>
          {filteredSpeaking.length > 0 && (
            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{filteredSpeaking.length}</span>
          )}
        </div>
        {filteredSpeaking.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <Mic size={36} className="mx-auto text-gray-200 mb-3" />
            <p className="font-semibold text-gray-500">채점 대기 중인 스피킹 답안이 없어요</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSpeaking.map(a => (
              <GradeSpeakingPanel key={a.id} answer={a} />
            ))}
          </div>
        )}
      </div>

      {/* 서술형 채점 대기 */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-bold text-gray-900">서술형 채점 대기</h2>
          {filtered.length > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{filtered.length}</span>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <Clock size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="font-semibold text-gray-500">채점 대기 중인 서술형 답안이 없어요</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(a => (
              <GradeEssayPanel key={a.id} answer={a} />
            ))}
          </div>
        )}
      </div>

      {/* 채점 완료 */}
      {gradedFiltered.length > 0 && (
        <div>
          <h2 className="font-bold text-gray-900 mb-4">최근 채점 완료</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {gradedFiltered.map(a => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const q = a.questions as any
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const sub = a.submissions as any
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const profile = sub?.profiles as any
              return (
                <div key={a.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400">{sub?.exams?.title} • {profile?.name}</p>
                    <p className="text-sm text-gray-700 line-clamp-1 mt-0.5">{q?.content}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">학생 답:</span>
                    <span className="text-sm text-gray-700 font-medium">{a.student_answer}</span>
                  </div>
                  <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${a.is_correct ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                    {a.is_correct ? `✓ ${a.score}점` : '✗ 오답'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
