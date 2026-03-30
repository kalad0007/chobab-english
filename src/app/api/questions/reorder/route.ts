import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { updates } = await req.json() as { updates: { id: string; set_order: number }[] }
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'updates required' }, { status: 400 })
  }

  // 각 문제의 set_order를 업데이트 (teacher_id 검증 포함)
  const results = await Promise.all(
    updates.map(({ id, set_order }) =>
      supabase.from('questions').update({ set_order }).eq('id', id).eq('teacher_id', user.id)
    )
  )

  const failed = results.find(r => r.error)
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
