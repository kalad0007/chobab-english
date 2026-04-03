import { redirect } from 'next/navigation'
import { getUserFromCookie, createClient } from '@/lib/supabase/server'

export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  const user = await getUserFromCookie()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'superadmin') redirect('/teacher/dashboard')

  return <>{children}</>
}
