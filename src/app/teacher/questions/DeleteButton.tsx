'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Trash2, Loader2 } from 'lucide-react'

export default function DeleteButton({ id }: { id: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [state, setState] = useState<'idle' | 'loading'>('idle')

  async function handleDelete() {
    if (!confirm('이 문제를 삭제하시겠습니까?')) return
    setState('loading')
    const { error } = await supabase
      .from('questions')
      .update({ is_active: false })
      .eq('id', id)
    if (error) {
      alert('삭제 실패: ' + error.message)
      setState('idle')
      return
    }
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={state === 'loading'}
      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition disabled:opacity-50"
      title="문제 삭제"
    >
      {state === 'loading'
        ? <Loader2 size={12} className="animate-spin" />
        : <Trash2 size={12} />
      }
      삭제
    </button>
  )
}
