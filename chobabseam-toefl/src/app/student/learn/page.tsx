import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import LearnClient from './LearnClient'

export default async function LearnPage() {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return null

  // 내 반 목록
  const { data: memberships } = await supabase
    .from('class_members')
    .select('class_id')
    .eq('student_id', user.id)
  const classIds = (memberships ?? []).map(m => m.class_id)

  // 공개된 자료: 전체 공개(class_id IS NULL) or 내 반 자료
  let query = supabase
    .from('learning_contents')
    .select('id, title, category, class_id, content, created_at, classes(name)')
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  if (classIds.length > 0) {
    // 전체공개 OR 내 반
    query = query.or(`class_id.is.null,class_id.in.(${classIds.join(',')})`)
  } else {
    // 반 없으면 전체공개만
    query = query.is('class_id', null)
  }

  const { data: contents } = await query

  return <LearnClient contents={contents ?? []} />
}
