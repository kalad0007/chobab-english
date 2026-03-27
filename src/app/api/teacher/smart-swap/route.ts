import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SLOT_SUBTYPES: Record<string, string[]> = {
  fill_blank:   ['complete_the_words', 'sentence_completion'],
  daily_life:   ['read_in_daily_life'],
  deep_reading: ['factual', 'negative_factual', 'inference', 'rhetorical_purpose',
                 'vocabulary', 'reference', 'sentence_simplification', 'insert_text'],
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { difficulty, slotType, excludeIds } = await req.json()
  // difficulty: FLOAT 1.0~6.0

  const subtypes = SLOT_SUBTYPES[slotType] ?? []
  const usedIds: string[] = excludeIds ?? []

  // ±1.0 넓은 풀에서 목표 난이도 가장 가까운 5개
  let query = supabase
    .from('questions')
    .select('id, content, difficulty, question_subtype, passage_id, type, category, options')
    .eq('category', 'reading')
    .eq('is_active', true)
    .gte('difficulty', Math.max(1.0, difficulty - 1.0))
    .lte('difficulty', Math.min(6.0, difficulty + 1.0))
    .order('created_at', { ascending: false })
    .limit(50)

  if (subtypes.length > 0)
    query = query.in('question_subtype', subtypes)
  if (usedIds.length > 0)
    query = query.not('id', 'in', `(${usedIds.map(id => `'${id}'`).join(',')})`)

  const { data: raw, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 거리 순 정렬 후 셔플 → 5개 추출
  const candidates = (raw ?? [])
    .sort((a, b) => Math.abs(a.difficulty - difficulty) - Math.abs(b.difficulty - difficulty))
    .slice(0, 20)
    .sort(() => Math.random() - 0.5)
    .slice(0, 5)

  return NextResponse.json({ candidates })
}
