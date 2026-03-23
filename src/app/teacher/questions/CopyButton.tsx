'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Copy, Check, Loader2 } from 'lucide-react'

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  question: any
}

export default function CopyButton({ question }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')

  async function handleCopy() {
    setState('loading')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setState('idle'); return }

    const { error } = await supabase.from('questions').insert({
      teacher_id: user.id,
      type: question.type,
      category: question.category,
      subcategory: question.subcategory ?? null,
      difficulty: question.difficulty,
      passage: question.passage ?? null,
      content: `[복사] ${question.content}`,
      options: question.options ?? null,
      answer: question.answer,
      explanation: question.explanation ?? null,
      source: 'teacher',
    })

    if (error) {
      setState('idle')
      alert('복사 실패: ' + error.message)
      return
    }

    setState('done')
    router.refresh()

    // 2초 후 아이콘 원래대로
    setTimeout(() => setState('idle'), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      disabled={state === 'loading'}
      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-gray-100 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
      title="문제 복사"
    >
      {state === 'loading' ? (
        <Loader2 size={12} className="animate-spin" />
      ) : state === 'done' ? (
        <><Check size={12} className="text-emerald-600" /> 완료</>
      ) : (
        <><Copy size={12} /> 복사</>
      )}
    </button>
  )
}
