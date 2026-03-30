'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateExamDescription(examId: string, description: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('exams')
    .update({ description })
    .eq('id', examId)
  if (error) throw new Error(error.message)
  revalidatePath(`/teacher/exams/${examId}`)
}
