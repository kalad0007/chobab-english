'use client'

import { useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteCollocationQuiz } from '../collocation-quiz-actions'

export default function DeleteQuizButton({ quizId }: { quizId: string }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!confirm('이 퀴즈를 삭제할까요?')) return
    startTransition(async () => {
      await deleteCollocationQuiz(quizId)
    })
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="flex-shrink-0 p-2 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition disabled:opacity-40 min-h-[44px] min-w-[44px] flex items-center justify-center"
    >
      <Trash2 size={16} />
    </button>
  )
}
