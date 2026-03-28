import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const category  = searchParams.get('category') ?? 'reading'
  const subtype   = searchParams.get('subtype')  ?? ''
  const subtypes  = searchParams.get('subtypes') ?? '' // 콤마 구분 다중 subtype
  const keyword   = searchParams.get('q')        ?? ''

  let query = supabase
    .from('questions')
    .select('id, content, difficulty, question_subtype, type, category, passage, passage_group_id, audio_url')
    .eq('teacher_id', user.id)
    .eq('category', category)
    .eq('is_active', true)
    .not('passage_group_id', 'is', null)
    .order('passage_group_id')
    .order('created_at')

  if (subtype)        query = query.eq('question_subtype', subtype)
  else if (subtypes)  query = query.in('question_subtype', subtypes.split(',').map(s => s.trim()))
  if (keyword)        query = query.ilike('content', `%${keyword}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // passage_group_id 기준으로 그룹핑
  const setMap = new Map<string, NonNullable<typeof data>>()
  for (const q of data ?? []) {
    if (!q.passage_group_id) continue
    const arr = setMap.get(q.passage_group_id) ?? []
    arr.push(q)
    setMap.set(q.passage_group_id, arr)
  }

  const sets = Array.from(setMap.entries()).map(([groupId, qs]) => {
    const avg = qs.reduce((s, q) => s + (q.difficulty ?? 3), 0) / qs.length
    return {
      passage_group_id: groupId,
      passage: qs[0]?.passage ?? '',
      audio_url: (qs[0] as { audio_url?: string | null }).audio_url ?? null,
      question_subtype: qs[0]?.question_subtype ?? null,
      difficulty: Math.round(avg * 2) / 2,
      questions: qs.map(q => ({
        id: q.id,
        content: q.content,
        difficulty: q.difficulty,
        question_subtype: q.question_subtype,
        type: q.type,
        category: q.category,
      })),
    }
  })

  return NextResponse.json({ sets, total: sets.length })
}
