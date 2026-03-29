import { createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import Link from 'next/link'
import { BookMarked, ChevronLeft } from 'lucide-react'
import DeleteWordButton from './DeleteWordButton'

export const dynamic = 'force-dynamic'

export default async function MyWordsPage() {
  const user = await getUserFromCookie()
  if (!user) return null

  const admin = createAdminClient()
  const { data: words } = await admin
    .from('student_words')
    .select('id, word, meaning_ko, context, passage_title, passage_id, created_at')
    .eq('student_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-2xl mx-auto px-5 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/student/passages" className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <BookMarked size={20} className="text-purple-500" /> 내 단어장
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">지문에서 저장한 단어 {(words ?? []).length}개</p>
        </div>
      </div>

      {(!words || words.length === 0) ? (
        <div className="text-center py-16 text-gray-400">
          <BookMarked size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">저장된 단어가 없습니다</p>
          <p className="text-sm mt-1">독해 지문의 주요 어휘에서 ★ 버튼을 눌러 단어를 저장하세요</p>
          <Link href="/student/passages" className="inline-block mt-4 px-4 py-2 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-700 transition">
            지문 보러 가기
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {words.map(w => (
            <div key={w.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-extrabold text-gray-900">{w.word}</span>
                  <span className="text-sm text-purple-700 font-semibold">{w.meaning_ko}</span>
                </div>
                {w.context && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{w.context}</p>}
                {w.passage_title && (
                  <p className="text-[10px] text-gray-300 mt-1">
                    {w.passage_id ? (
                      <Link href={`/student/passages/${w.passage_id}`} className="hover:text-purple-400 transition">
                        📄 {w.passage_title}
                      </Link>
                    ) : w.passage_title}
                  </p>
                )}
              </div>
              <DeleteWordButton wordId={w.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
