import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SLOT_SUBTYPES: Record<string, string[]> = {
  listen_and_repeat: ['listen_and_repeat'],
  interview:         ['take_an_interview'],
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { classId, targetBand, maxBand, slotType, count, excludeIds } = await req.json()
  // targetBand: FLOAT 1.0~6.0

  const usedIds: string[] = [...(excludeIds ?? [])]
  if (classId) {
    const { data: exams } = await supabase
      .from('exams').select('id').eq('class_id', classId)
    if (exams?.length) {
      const { data: eq } = await supabase
        .from('exam_questions').select('question_id')
        .in('exam_id', exams.map((e: { id: string }) => e.id))
      eq?.forEach((r: { question_id: string }) => usedIds.push(r.question_id))
    }
  }

  const subtypes = SLOT_SUBTYPES[slotType] ?? []

  let query = supabase
    .from('questions')
    .select('id, content, difficulty, question_subtype, audio_url, type, category')
    .eq('category', 'speaking')
    .eq('is_active', true)
    .gte('difficulty', Math.max(1.0, targetBand - 1.0))
    .lte('difficulty', Math.min(6.0, Math.min(maxBand ?? 6.0, targetBand + 1.0)))
    .order('created_at', { ascending: false })
    .limit(100)

  if (subtypes.length > 0)
    query = query.in('question_subtype', subtypes)
  if (usedIds.length > 0)
    query = query.not('id', 'in', `(${usedIds.map(id => `'${id}'`).join(',')})`)

  const { data: raw, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const shuffled = (raw ?? [])
    .sort((a, b) => Math.abs(a.difficulty - targetBand) - Math.abs(b.difficulty - targetBand))
    .slice(0, count * 3)
    .sort(() => Math.random() - 0.5)
    .slice(0, count)

  return NextResponse.json({ questions: shuffled })
}
