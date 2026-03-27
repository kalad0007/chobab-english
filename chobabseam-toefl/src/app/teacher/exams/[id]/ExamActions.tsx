'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Play, Square, Trash2, Loader2 } from 'lucide-react'

interface Props {
  examId: string
  currentStatus: string
}

export default function ExamActions({ examId, currentStatus }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function updateStatus(status: string) {
    setLoading(true)
    await supabase.from('exams').update({ status }).eq('id', examId)
    router.refresh()
    setLoading(false)
  }

  async function deleteExam() {
    if (!confirm('정말로 이 시험을 삭제하시겠어요?')) return
    setLoading(true)
    await supabase.from('exams').delete().eq('id', examId)
    router.push('/teacher/exams')
  }

  return (
    <div className="flex items-center gap-2">
      {currentStatus === 'draft' && (
        <button
          onClick={() => updateStatus('published')}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          배포
        </button>
      )}
      {currentStatus === 'published' && (
        <button
          onClick={() => updateStatus('closed')}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold transition"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />}
          종료
        </button>
      )}
      {currentStatus === 'closed' && (
        <button
          onClick={() => updateStatus('published')}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-sm font-bold transition"
        >
          재배포
        </button>
      )}
      <button
        onClick={deleteExam}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-semibold transition"
      >
        <Trash2 size={14} />
        삭제
      </button>
    </div>
  )
}
