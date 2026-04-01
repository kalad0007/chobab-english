import { createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import Link from 'next/link'
import { Sparkles, Plus, Trash2, Users, BookOpen, Eye, EyeOff } from 'lucide-react'
import SetsClient from './SetsClient'

export const dynamic = 'force-dynamic'

const TOPIC_EMOJI: Record<string, string> = {
  biology: '🧬', chemistry: '⚗️', physics: '⚛️', astronomy: '🔭',
  geology: '🪨', ecology: '🌿', history_us: '🗽', history_world: '🌍',
  anthropology: '🏺', psychology: '🧠', sociology: '👥', economics: '📊',
  art_music: '🎨', literature: '📚', architecture: '🏛️', environmental: '🌊',
  linguistics: '🗣️', general: '📝',
}

export default async function VocabSetsPage() {
  const user = await getUserFromCookie()
  if (!user) return null

  const admin = createAdminClient()

  // Load sets with linked classes
  const { data: sets } = await admin
    .from('vocab_sets')
    .select('id, title, topic_category, difficulty, word_count, word_level, is_published, published_at, created_at')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false })

  const setIds = (sets ?? []).map(s => s.id)
  const { data: setClasses } = setIds.length > 0
    ? await admin.from('vocab_set_classes')
        .select('set_id, class_id, classes(name)')
        .in('set_id', setIds)
    : { data: [] }

  // Load teacher's classes
  const { data: classes } = await admin
    .from('classes')
    .select('id, name')
    .eq('teacher_id', user.id)
    .order('created_at')

  const classMap: Record<string, { classId: string; className: string }[]> = {}
  for (const sc of setClasses ?? []) {
    if (!classMap[sc.set_id]) classMap[sc.set_id] = []
    classMap[sc.set_id].push({
      classId: sc.class_id,
      className: (sc.classes as unknown as { name: string } | null)?.name ?? '',
    })
  }

  const enriched = (sets ?? []).map(s => ({
    ...s,
    classes: classMap[s.id] ?? [],
    topicEmoji: TOPIC_EMOJI[s.topic_category] ?? '📝',
  }))

  return (
    <div className="p-3 md:p-7">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg md:text-2xl font-extrabold text-gray-900 flex items-center gap-2">📦 단어 세트 관리</h1>
          <p className="text-gray-500 text-xs mt-0.5 hidden md:block">AI로 생성한 단어 묶음을 반별로 배포합니다</p>
        </div>
        <Link href="/teacher/vocab/generate"
          className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs md:text-sm font-bold rounded-xl transition">
          <Sparkles size={13} /> 새 세트 생성
        </Link>
      </div>

      {enriched.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="text-5xl mb-4">📦</div>
          <p className="font-bold text-gray-400 text-lg">아직 단어 세트가 없어요</p>
          <p className="text-sm text-gray-300 mt-1 mb-6">AI로 주제별 단어 세트를 생성해 반에 배포하세요</p>
          <Link href="/teacher/vocab/generate"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl transition">
            <Sparkles size={15} /> 첫 세트 만들기
          </Link>
        </div>
      ) : (
        <SetsClient sets={enriched} allClasses={classes ?? []} />
      )}
    </div>
  )
}
