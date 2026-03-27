import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const category  = searchParams.get('category') ?? 'reading'
  const subtype   = searchParams.get('subtype')  ?? ''
  const keyword   = searchParams.get('q')        ?? ''
  const diffStr   = searchParams.get('difficulty') ?? ''
  const page      = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const PER_PAGE  = 20

  let query = supabase
    .from('questions')
    .select('id, content, difficulty, question_subtype, type, category, options', { count: 'exact' })
    .eq('category', category)
    .eq('is_active', true)
    .order('difficulty', { ascending: true })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1)

  if (subtype)  query = query.eq('question_subtype', subtype)
  if (diffStr) {
    const d = parseFloat(diffStr)
    if (!isNaN(d)) query = query.gte('difficulty', d - 0.75).lte('difficulty', d + 0.75)
  }
  if (keyword) query = query.ilike('content', `%${keyword}%`)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const total = count ?? 0
  return NextResponse.json({
    questions:  data ?? [],
    total,
    page,
    perPage:    PER_PAGE,
    totalPages: Math.ceil(total / PER_PAGE),
  })
}
