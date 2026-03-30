'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronUp, ChevronDown, Loader2 } from 'lucide-react'

interface Props {
  questionId: string
  idx: number
  total: number
  allIds: string[]
}

export default function SetOrderButtons({ questionId, idx, total, allIds }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function move(dir: 'up' | 'down') {
    if (loading) return
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= total) return

    setLoading(true)
    const newOrder = [...allIds]
    ;[newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]]

    await fetch('/api/questions/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: newOrder.map((id, i) => ({ id, set_order: i + 1 })) }),
    })
    setLoading(false)
    router.refresh()
  }

  if (loading) {
    return <Loader2 size={14} className="animate-spin text-gray-400" />
  }

  return (
    <div className="flex flex-col">
      <button
        onClick={() => move('up')}
        disabled={idx === 0}
        className="p-0.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed transition"
        title="위로"
      >
        <ChevronUp size={15} />
      </button>
      <button
        onClick={() => move('down')}
        disabled={idx === total - 1}
        className="p-0.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed transition"
        title="아래로"
      >
        <ChevronDown size={15} />
      </button>
    </div>
  )
}
