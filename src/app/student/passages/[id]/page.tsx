import { createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PassageReader from './PassageReader'

export const dynamic = 'force-dynamic'

export default async function PassagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getUserFromCookie()
  if (!user) return null

  const admin = createAdminClient()

  // Access check
  const { data: memberships } = await admin
    .from('class_members').select('class_id').eq('student_id', user.id)
  const classIds = (memberships ?? []).map(m => m.class_id)

  const { data: pc } = await admin
    .from('passage_classes').select('passage_id').eq('passage_id', id).in('class_id', classIds).single()
  if (!pc) return notFound()

  const { data: passage } = await admin
    .from('passages')
    .select('id, title, topic_category, difficulty, source')
    .eq('id', id).eq('is_published', true).single()
  if (!passage) return notFound()

  const { data: paragraphs } = await admin
    .from('passage_paragraphs')
    .select('id, order_num, text, text_ko, explanation, annotations')
    .eq('passage_id', id)
    .order('order_num')

  return (
    <PassageReader
      passage={passage}
      paragraphs={(paragraphs ?? []).map(p => ({
        id: p.id,
        order_num: p.order_num,
        text: p.text,
        text_ko: p.text_ko ?? '',
        explanation: (p as Record<string, unknown>).explanation as string ?? '',
        annotations: (p.annotations ?? []) as {
          type: 'highlight' | 'chunk' | 'vocab'
          start: number; end: number
          word?: string; definition_ko?: string; definition_en?: string; synonyms?: string[]
        }[],
      }))}
    />
  )
}
