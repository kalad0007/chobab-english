import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import CollocationQuizNewClient from './CollocationQuizNewClient'
import WordPickerClient from './WordPickerClient'
import { BookOpen, Zap, ChevronLeft, BookMarked, BookA } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ setId?: string; mode?: string; wordIds?: string }>
}

export default async function CollocationQuizNewPage({ searchParams }: PageProps) {
  const user = await getUserFromCookie()
  if (!user) redirect('/login')

  const { setId, mode, wordIds } = await searchParams
  const admin = createAdminClient()

  // --- 모드 선택 화면 (파라미터 없음) ---
  if (!setId && !mode) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
            <Link href="/teacher/vocab/collocation-quiz" className="text-gray-400 hover:text-gray-600">
              <ChevronLeft size={20} />
            </Link>
            <h1 className="text-lg font-bold text-gray-900">스와이프 퀴즈 만들기</h1>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 py-8">
          <p className="text-sm text-gray-500 mb-6">퀴즈를 어떻게 만들까요?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/teacher/vocab/collocation-quiz/new?mode=sets"
              className="bg-white rounded-2xl border-2 border-gray-100 hover:border-purple-400 p-6 text-center transition group"
            >
              <BookMarked size={32} className="mx-auto text-purple-400 mb-3" />
              <h3 className="font-bold text-gray-900 mb-1">세트로 만들기</h3>
              <p className="text-xs text-gray-400">단어 세트에서 연어를 선택해 퀴즈를 만들어요</p>
            </Link>
            <Link
              href="/teacher/vocab/collocation-quiz/new?mode=words"
              className="bg-white rounded-2xl border-2 border-gray-100 hover:border-purple-400 p-6 text-center transition group"
            >
              <BookA size={32} className="mx-auto text-purple-400 mb-3" />
              <h3 className="font-bold text-gray-900 mb-1">개별 단어 선택</h3>
              <p className="text-xs text-gray-400">단어를 직접 골라서 퀴즈를 만들어요</p>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // --- 세트 선택 화면 (mode=sets 또는 setId 없을 때) ---
  if (mode === 'sets' || (!setId && mode !== 'words')) {
    const { data: sets } = await admin
      .from('vocab_sets')
      .select('id, title, word_count')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false })

    const setsWithCounts = (await Promise.all(
      (sets ?? []).map(async s => {
        const { data: words } = await admin
          .from('vocab_set_words')
          .select('vocab_words(collocations)')
          .eq('set_id', s.id)

        type WordCollocRow = { collocations: string[] }
        const collocCount = (words ?? []).filter(r => {
          const w = r.vocab_words as unknown as WordCollocRow | null
          return Array.isArray(w?.collocations) && (w?.collocations.length ?? 0) > 0
        }).length

        return { ...s, collocCount }
      })
    )).filter(s => s.collocCount > 0)

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
            <Link href="/teacher/vocab/collocation-quiz/new" className="text-gray-400 hover:text-gray-600">
              <ChevronLeft size={20} />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900">스와이프 퀴즈 만들기</h1>
              <p className="text-sm text-gray-500 mt-0.5">퀴즈를 만들 어휘 세트를 선택하세요</p>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-5">
          {setsWithCounts.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">어휘 세트가 없습니다.</p>
              <Link
                href="/teacher/vocab/sets"
                className="mt-3 inline-block text-sm text-purple-600 font-semibold hover:underline"
              >
                어휘 세트 만들러 가기
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {setsWithCounts.map(s => (
                <Link
                  key={s.id}
                  href={`/teacher/vocab/collocation-quiz/new?setId=${s.id}`}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:border-purple-400 hover:shadow-sm transition group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate group-hover:text-purple-700">
                        {s.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">단어 {s.word_count}개</p>
                    </div>
                    <span className={`flex-shrink-0 flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${
                      s.collocCount > 0
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      <Zap size={11} />
                      연어 {s.collocCount}개
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // --- 단어 피커 화면 (mode=words, wordIds 없음) ---
  if (mode === 'words' && !wordIds) {
    const { data: allWords } = await admin
      .from('vocab_words')
      .select('id, word, part_of_speech, definition_ko, collocations, topic_category, difficulty')
      .eq('teacher_id', user.id)
      .eq('is_active', true)
      .not('collocations', 'is', null)
      .order('word')

    const wordsWithCollocations = (allWords ?? []).filter(
      w => Array.isArray(w.collocations) && w.collocations.length > 0
    )

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
            <Link href="/teacher/vocab/collocation-quiz/new" className="text-gray-400 hover:text-gray-600">
              <ChevronLeft size={20} />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900">개별 단어 선택</h1>
              <p className="text-sm text-gray-500 mt-0.5">퀴즈에 넣을 단어를 골라보세요</p>
            </div>
          </div>
        </div>
        <WordPickerClient words={wordsWithCollocations} />
      </div>
    )
  }

  // --- 개별 단어 퀴즈 설정 (mode=words&wordIds=...) ---
  if (mode === 'words' && wordIds) {
    const ids = wordIds.split(',').filter(Boolean)

    const { data: selectedWords } = await admin
      .from('vocab_words')
      .select('id, word, part_of_speech, collocations')
      .in('id', ids)
      .eq('teacher_id', user.id)

    type RawWord = { id: string; word: string; part_of_speech: string; collocations: string[] }
    const wordsWithCollocations = (selectedWords ?? []).filter(
      (w): w is RawWord => Array.isArray(w.collocations) && w.collocations.length > 0
    )

    const { data: classesData } = await admin
      .from('classes')
      .select('id, name')
      .eq('teacher_id', user.id)
      .order('name')

    return (
      <CollocationQuizNewClient
        set={null}
        words={wordsWithCollocations}
        allClasses={classesData ?? []}
      />
    )
  }

  // --- setId 있으면 퀴즈 설정 화면 (기존 로직) ---
  const { data: set } = await admin
    .from('vocab_sets')
    .select('id, title, word_count')
    .eq('id', setId!)
    .eq('teacher_id', user.id)
    .single()

  if (!set) redirect('/teacher/vocab/collocation-quiz/new')

  const { data: setWords } = await admin
    .from('vocab_set_words')
    .select('order_num, vocab_words(id, word, part_of_speech, collocations)')
    .eq('set_id', setId!)
    .order('order_num')

  type RawWord = { id: string; word: string; part_of_speech: string; collocations: string[] }

  const wordsWithCollocations = (setWords ?? [])
    .map(r => r.vocab_words as unknown as RawWord | null)
    .filter((w): w is RawWord => !!w && Array.isArray(w.collocations) && w.collocations.length > 0)

  const { data: classesData } = await admin
    .from('classes')
    .select('id, name')
    .eq('teacher_id', user.id)
    .order('name')

  return (
    <CollocationQuizNewClient
      set={set}
      words={wordsWithCollocations}
      allClasses={classesData ?? []}
    />
  )
}
