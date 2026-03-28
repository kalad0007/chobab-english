import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import ContentsClient from './ContentsClient'

export default async function ContentsPage() {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return null

  // Assets from new learning_assets table
  const { data: assets } = await supabase
    .from('learning_assets')
    .select('id, asset_type, title, tags, file_url, transcript, created_at, metadata')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false })

  // Question counts per subtype (for template vault)
  const { data: questionRows } = await supabase
    .from('questions')
    .select('question_subtype')
    .eq('teacher_id', user.id)
    .eq('is_active', true)

  const questionCounts: Record<string, number> = {}
  for (const row of questionRows ?? []) {
    if (row.question_subtype) {
      questionCounts[row.question_subtype] = (questionCounts[row.question_subtype] ?? 0) + 1
    }
  }

  return (
    <ContentsClient
      assets={assets ?? []}
      questionCounts={questionCounts}
    />
  )
}
