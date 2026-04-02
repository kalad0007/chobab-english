import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import { Zap, Plus, BookOpen, Users } from 'lucide-react'
import DeleteQuizButton from './DeleteQuizButton'
import RenameQuizButton from './RenameQuizButton'

export default async function CollocationQuizListPage() {
  const user = await getUserFromCookie()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: quizzes } = await admin
    .from('collocation_quizzes')
    .select(`
      id, title, status, created_at,
      vocab_sets(title),
      collocation_quiz_items(count),
      collocation_quiz_classes(class_id, classes(name))
    `)
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Zap size={20} className="text-purple-600" />
              스와이프 퀴즈
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">총 {quizzes?.length ?? 0}개</p>
          </div>
          <Link
            href="/teacher/vocab/collocation-quiz/new"
            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold px-3.5 py-2.5 rounded-xl transition min-h-[44px]"
          >
            <Plus size={15} />
            새 퀴즈 만들기
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5">
        {!quizzes || quizzes.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Zap size={40} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">아직 만든 스와이프 퀴즈가 없어요.</p>
            <Link
              href="/teacher/vocab/collocation-quiz/new"
              className="mt-3 inline-block text-sm text-purple-600 font-semibold hover:underline"
            >
              첫 퀴즈 만들기
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {quizzes.map(q => {
              const setTitle = (q.vocab_sets as unknown as { title: string } | null)?.title ?? '-'
              const itemCount = (q.collocation_quiz_items as unknown as { count: number }[])?.[0]?.count ?? 0
              const classes = (q.collocation_quiz_classes as unknown as { class_id: string; classes: { name: string } | null }[] ?? [])
                .map(c => c.classes?.name).filter(Boolean)

              return (
                <div
                  key={q.id}
                  className="bg-white rounded-xl border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <RenameQuizButton quizId={q.id} title={q.title} />
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          q.status === 'published'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {q.status === 'published' ? '배포됨' : '임시저장'}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <BookOpen size={11} />
                          {setTitle}
                        </span>
                        <span className="flex items-center gap-1">
                          <Zap size={11} />
                          {itemCount}개 항목
                        </span>
                      </div>
                      {classes.length > 0 && (
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                          <Users size={11} className="text-gray-400 flex-shrink-0" />
                          {classes.map(name => (
                            <span
                              key={name}
                              className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <DeleteQuizButton quizId={q.id} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
