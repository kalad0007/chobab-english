import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import ContentsClient from './ContentsClient'

export default async function ContentsPage() {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return null

  const [{ data: contents }, { data: classes }] = await Promise.all([
    supabase
      .from('learning_contents')
      .select('id, title, category, class_id, is_published, created_at, content')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('classes')
      .select('id, name')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: true }),
  ])

  return (
    <ContentsClient
      contents={contents ?? []}
      classes={classes ?? []}
    />
  )
}
