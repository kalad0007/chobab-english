import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import Link from 'next/link'
import { CATEGORY_LABELS, QUESTION_SUBTYPE_LABELS, difficultyStars } from '@/lib/utils'
import { Sparkles, Plus, BookOpen } from 'lucide-react'
import type { Question } from '@/types/database'
import CopyButton from './CopyButton'

const CATEGORY_COLORS: Record<string, string> = {
  reading:    'bg-blue-100 text-blue-700',
  listening:  'bg-emerald-100 text-emerald-700',
  speaking:   'bg-orange-100 text-orange-700',
  writing:    'bg-purple-100 text-purple-700',
}

const CATEGORY_ICON: Record<string, string> = {
  reading: '📖', listening: '🎧', speaking: '🎤', writing: '✍️',
}

const SOURCE_LABEL: Record<string, string> = {
  teacher:        '직접 출제',
  ai_generated:   'AI 생성',
  toefl_official: 'TOEFL 기출',
}

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; type?: string; difficulty?: string; q?: string }>
}) {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return null

  const params = await searchParams
  const { category, type, difficulty, q } = params

  let query = supabase
    .from('questions')
    .select('*')
    .eq('teacher_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (category) query = query.eq('category', category)
  if (type) query = query.eq('type', type)
  if (difficulty) query = query.eq('difficulty', parseInt(difficulty))
  if (q) query = query.ilike('content', `%${q}%`)

  const { data: questions } = await query

  // 카테고리별 개수
  const { data: counts } = await supabase
    .from('questions')
    .select('category')
    .eq('teacher_id', user.id)
    .eq('is_active', true)

  const countByCategory: Record<string, number> = {}
  for (const row of counts ?? []) {
    countByCategory[row.category] = (countByCategory[row.category] ?? 0) + 1
  }

  return (
    <div className="p-4 md:p-7">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">📚 문제은행</h1>
          <p className="text-gray-500 text-sm mt-1">총 {(questions ?? []).length}개 문제</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/teacher/questions/generate"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition"
          >
            <Sparkles size={15} /> AI 문제 생성
          </Link>
          <Link
            href="/teacher/questions/new"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition"
          >
            <Plus size={15} /> 직접 출제
          </Link>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-5">
        {/* 카테고리 필터 - 모바일: 가로 스크롤, 데스크탑: 세로 목록 */}
        <div className="md:w-44 flex-shrink-0">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2 mb-2 hidden md:block">카테고리</p>
          <div className="flex md:flex-col gap-1 overflow-x-auto pb-1 md:pb-0 md:space-y-1">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2 mb-2">카테고리</p>
          <Link
            href="/teacher/questions"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${!category ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <span>전체</span>
            <span className="text-xs text-gray-400">{Object.values(countByCategory).reduce((a, b) => a + b, 0)}</span>
          </Link>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <Link
              key={key}
              href={`/teacher/questions?category=${key}`}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${category === key ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <span>{label}</span>
              <span className="text-xs text-gray-400">{countByCategory[key] ?? 0}</span>
            </Link>
          ))}
          </div>
        </div>

        {/* 문제 목록 */}
        <div className="flex-1">
          {/* 검색/필터 바 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
            <form className="flex flex-wrap gap-2" method="GET">
              {category && <input type="hidden" name="category" value={category} />}
              <input
                name="q"
                defaultValue={q}
                placeholder="문제 내용 검색..."
                className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select name="type" defaultValue={type ?? ''} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none">
                <option value="">모든 유형</option>
                <option value="multiple_choice">객관식 (R/L)</option>
                <option value="essay">서술형 (S/W)</option>
              </select>
              <select name="difficulty" defaultValue={difficulty ?? ''} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none">
                <option value="">모든 난이도</option>
                <option value="1">50-60점대</option>
                <option value="2">60-80점대</option>
                <option value="3">80-90점대</option>
                <option value="4">90-100점대</option>
                <option value="5">100+점대</option>
              </select>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition">검색</button>
            </form>
          </div>

          {/* 문제 카드 목록 */}
          <div className="space-y-2">
            {(questions ?? []).length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                <BookOpen size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-400 font-medium">문제가 없어요</p>
                <p className="text-gray-300 text-sm mt-1">AI로 생성하거나 직접 출제해보세요</p>
              </div>
            ) : (
              (questions as Question[]).map(q => (
                <div key={q.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start gap-4 hover:border-blue-200 transition group">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${CATEGORY_COLORS[q.category] ?? 'bg-gray-100 text-gray-600'}`}>
                    {CATEGORY_ICON[q.category] ?? '📘'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[q.category] ?? 'bg-gray-100 text-gray-600'}`}>
                        {CATEGORY_LABELS[q.category] ?? q.category}
                      </span>
                      {q.question_subtype && (
                        <span className="text-xs text-gray-500 font-medium">
                          {QUESTION_SUBTYPE_LABELS[q.category]?.[q.question_subtype] ?? q.question_subtype}
                        </span>
                      )}
                      {q.task_number && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">Task {q.task_number}</span>
                      )}
                      <span className="text-xs text-amber-500">{difficultyStars(q.difficulty)}</span>
                      {q.source !== 'teacher' && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${q.source === 'ai_generated' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                          {SOURCE_LABEL[q.source]}
                        </span>
                      )}
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(q as any).audio_url && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">🎧 음성있음</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-800 font-medium line-clamp-2">{q.content}</p>
                    {q.attempt_count > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        정답률 {q.attempt_count > 0 ? Math.round((q.correct_count / q.attempt_count) * 100) : 0}% · 출제 {q.attempt_count}회
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                    <Link href={`/teacher/questions/${q.id}/edit`} className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                      수정
                    </Link>
                    <CopyButton question={q} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
