'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Copy, Check, Loader2 } from 'lucide-react'

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  question: any
  iconOnly?: boolean
}

export default function CopyButton({ question, iconOnly }: Props) {
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
      question_subtype: question.question_subtype ?? null,
      subcategory: question.subcategory ?? null,
      difficulty: question.difficulty,
      passage: question.passage ?? null,
      content: `[복사] ${question.content}`,
      summary: question.summary ?? null,
      options: question.options ?? null,
      answer: question.answer,
      explanation: question.explanation ?? null,
      audio_script: question.audio_script ?? null,
      audio_url: question.audio_url ?? null,
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

  if (iconOnly) {
    return (
      <button onClick={handleCopy} disabled={state === 'loading'} title="복사"
        className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-gray-600 disabled:opacity-50">
        {state === 'loading' ? (
          <Loader2 size={14} className="animate-spin" />
        ) : state === 'done' ? (
          <Check size={14} className="text-emerald-600" />
        ) : (
          <Copy size={14} />
        )}
      </button>
    )
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
