'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function DeleteWordButton({ wordId }: { wordId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    const supabase = createClient()
    await supabase.from('student_words').delete().eq('id', wordId)
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition disabled:opacity-40 flex-shrink-0"
      title="삭제"
    >
      <Trash2 size={14} />
    </button>
  )
}
