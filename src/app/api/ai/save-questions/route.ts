import { NextRequest, NextResponse } from 'next/server'
import { createClient, getUserFromCookie } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { questions } = await req.json()

  const rows = questions.map((q: {
    content: string; passage?: string; options: { num: number; text: string }[];
    answer: string; explanation?: string; category: string; difficulty: number
  }) => ({
    teacher_id: user.id,
    type: 'multiple_choice',
    content: q.content,
    passage: q.passage ?? null,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation ?? null,
    category: q.category,
    difficulty: q.difficulty,
    source: 'ai_generated',
  }))

  const { error } = await supabase.from('questions').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
