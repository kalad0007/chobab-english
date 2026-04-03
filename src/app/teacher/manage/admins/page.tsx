import { createClient } from '@/lib/supabase/server'
import AdminsClient from './AdminsClient'

export default async function ManageAdminsPage() {
  const supabase = await createClient()

  const { data: admins } = await supabase
    .from('profiles')
    .select('id, name, email, plan, credits, approved, created_at')
    .eq('role', 'admin')
    .order('created_at', { ascending: false })

  return <AdminsClient admins={admins ?? []} />
}
