import { createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import Link from 'next/link'
import { BookA, ChevronRight, Star } from 'lucide-react'

export const dynamic = 'force-dynamic'

const TOPIC_EMOJI: Record<string, string> = {
  biology: '🧬', chemistry: '⚗️', physics: '⚛️', astronomy: '🔭',
  geology: '🪨', ecology: '🌿', history_us: '🗽', history_world: '🌍',
  anthropology: '🏺', psychology: '🧠', sociology: '👥', economics: '📊',
  art_music: '🎨', literature: '📚', architecture: '🏛️', environmental: '🌊',
  linguistics: '🗣️', philosophy: '🧭', political_science: '🏛️',
  medicine: '🏥', technology: '⚙️', general: '📝',
}

export default async function StudentVocabPage() {
  const user = await getUserFromCookie()
  if (!user) return null

  const admin = createAdminClient()

  // Get the student's class IDs
  const { data: memberships } = await admin
    .from('class_members')
    .select('class_id')
    .eq('student_id', user.id)

  const classIds = (memberships ?? []).map(m => m.class_id)

  if (classIds.length === 0) {
    return (
      <div className="p-8 text-center max-w-md mx-auto pt-20">
        <BookA size={48} className="mx-auto text-gray-200 mb-4" />
        <p className="font-bold text-gray-400">아직 반에 등록되지 않았어요</p>
        <p className="text-sm text-gray-300 mt-1">선생님께 초대 코드를 받아 반에 참여하세요</p>
      </div>
    )
  }

  // Get published sets assigned to my classes
  const { data: setClassRows } = await admin
    .from('vocab_set_classes')
    .select('set_id')
    .in('class_id', classIds)

  const setIds = [...new Set((setClassRows ?? []).map(r => r.set_id))]

  const { data: sets } = setIds.length > 0
    ? await admin
        .from('vocab_sets')
        .select('id, title, topic_category, difficulty, word_count, published_at')
        .in('id', setIds)
        .eq('is_published', true)
        .order('published_at', { ascending: false })
    : { data: [] }

  // Get student progress count per set
  const progressResult: Record<string, number> = {}
  if (setIds.length > 0) {
    const { data: setWords } = await admin
      .from('vocab_set_words')
      .select('set_id, word_id')
      .in('set_id', setIds)

    const { data: progress } = await admin
      .from('vocab_progress')
      .select('word_id, repetitions')
      .eq('student_id', user.id)
      .gt('repetitions', 0)

    const learnedSet = new Set((progress ?? []).map(p => p.word_id))

    for (const row of setWords ?? []) {
      if (!progressResult[row.set_id]) progressResult[row.set_id] = 0
      if (learnedSet.has(row.word_id)) progressResult[row.set_id]++
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
          <BookA size={24} className="text-blue-600" /> 어휘 학습
        </h1>
        <p className="text-sm text-gray-400 mt-1">선생님이 배포한 단어 세트로 학습해요</p>
      </div>

      {(sets ?? []).length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
          <div className="text-5xl mb-4">📭</div>
          <p className="font-bold text-gray-400">아직 배포된 단어 세트가 없어요</p>
          <p className="text-sm text-gray-300 mt-1">선생님이 단어를 배포하면 여기에 나타납니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(sets ?? []).map(set => {
            const learned = progressResult[set.id] ?? 0
            const pct = set.word_count > 0 ? Math.round((learned / set.word_count) * 100) : 0
            const emoji = TOPIC_EMOJI[set.topic_category] ?? '📝'
            const isDone = pct === 100

            return (
              <Link
                key={set.id}
                href={`/student/vocab/${set.id}`}
                className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-blue-200 hover:shadow-md transition group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-2xl flex-shrink-0">
                    {emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900 text-sm truncate flex-1">{set.title}</h3>
                      {isDone && (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full flex-shrink-0">완료</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                      <span>📚 {set.word_count}단어</span>
                      <span>Band {set.difficulty.toFixed(1)}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${isDone ? 'bg-emerald-500' : 'bg-blue-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-gray-500 flex-shrink-0 font-medium">
                        {learned}/{set.word_count}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-400 flex-shrink-0 mt-1 transition" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
