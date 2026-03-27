'use client'

import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SetDeleteButton({ questionIds }: { groupId: string; questionIds: string[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!confirm(`이 세트(${questionIds.length}개 문제)를 모두 삭제하시겠어요?`)) return
    setLoading(true)
    const { error } = await supabase
      .from('questions')
      .update({ is_active: false })
      .in('id', questionIds)
    if (error) {
      alert('삭제 실패: ' + error.message)
      setLoading(false)
      return
    }
    router.push('/teacher/questions')
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-500 rounded-lg text-sm font-semibold hover:bg-red-50 transition disabled:opacity-50"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
      세트 삭제
    </button>
  )
}
