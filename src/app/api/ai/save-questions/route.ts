import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { questions } = await req.json()

  const ESSAY_SUBTYPES = new Set([
    'complete_the_words', 'sentence_completion', 'email_writing',
    'sentence_reordering', 'listen_and_repeat', 'take_an_interview',
  ])

  const rows = questions.map((q: {
    content: string; passage?: string | null; options?: { num: number; text: string }[] | null;
    answer: string; explanation?: string | null; category: string; difficulty: number;
    question_subtype?: string | null; audio_script?: string | null; speaking_prompt?: string | null;
    summary?: string | null; subcategory?: string | null;
  }) => ({
    teacher_id: user.id,
    type: ESSAY_SUBTYPES.has(q.question_subtype ?? '') ? 'essay' : 'multiple_choice',
    content: q.content,
    passage: q.passage ?? null,
    options: q.options ?? null,
    answer: q.answer,
    explanation: q.explanation ?? null,
    category: q.category,
    subcategory: q.subcategory ?? null,
    difficulty: q.difficulty,
    question_subtype: q.question_subtype ?? null,
    audio_script: q.audio_script ?? null,
    audio_url: null,
    audio_play_limit: null,
    speaking_prompt: q.speaking_prompt ?? null,
    preparation_time: null,
    response_time: null,
    word_limit: null,
    task_number: null,
    source: 'ai_generated',
    summary: q.summary ?? null,
  }))

  // Group questions sharing the same passage OR audio_script with a shared UUID
  const passageCounts = new Map<string, number>()
  const audioCounts = new Map<string, number>()
  for (const row of rows) {
    if (row.passage) passageCounts.set(row.passage, (passageCounts.get(row.passage) ?? 0) + 1)
    if (row.audio_script) audioCounts.set(row.audio_script, (audioCounts.get(row.audio_script) ?? 0) + 1)
  }
  type Row = (typeof rows)[number]
  const passageGroupMap = new Map<string, string>()
  const audioGroupMap = new Map<string, string>()
  const rowsWithGroups = rows.map((row: Row) => {
    if (row.passage && (passageCounts.get(row.passage) ?? 0) > 1) {
      if (!passageGroupMap.has(row.passage)) passageGroupMap.set(row.passage, crypto.randomUUID())
      return { ...row, passage_group_id: passageGroupMap.get(row.passage) }
    }
    if (row.audio_script && (audioCounts.get(row.audio_script) ?? 0) > 1) {
      if (!audioGroupMap.has(row.audio_script)) audioGroupMap.set(row.audio_script, crypto.randomUUID())
      return { ...row, passage_group_id: audioGroupMap.get(row.audio_script) }
    }
    return { ...row, passage_group_id: null }
  })

  const { error } = await supabase.from('questions').insert(rowsWithGroups)
  if (error) return NextResponse.json({ error: error.message, details: error.details }, { status: 500 })

  return NextResponse.json({ ok: true })
}
