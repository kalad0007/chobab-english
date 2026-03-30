'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS, getDiffInfo } from '@/lib/utils'
import { Eye, Layers, Trash2, Loader2, Pencil } from 'lucide-react'
import CopyButton from './CopyButton'

const CATEGORY_COLORS: Record<string, string> = {
  reading:   'bg-blue-100 text-blue-700',
  listening: 'bg-emerald-100 text-emerald-700',
  speaking:  'bg-orange-100 text-orange-700',
  writing:   'bg-purple-100 text-purple-700',
}
const CATEGORY_ICON: Record<string, string> = {
  reading: '📖', listening: '🎧', speaking: '🎤', writing: '✍️',
}

interface QuestionRow {
  id: string
  category: string
  difficulty: number
  content: string
  created_at: string
  attempt_count: number
  correct_count: number
  subcategory?: string | null
  summary?: string | null
  passage?: string | null
  audio_url?: string | null
  source?: string | null
  passage_group_id?: string | null
  question_subtype?: string | null
}

type ListItem =
  | { kind: 'set';      groupId: string; questions: QuestionRow[] }
  | { kind: 'question'; question: QuestionRow }

interface Props {
  listItems: ListItem[]
}

export default function QuestionsClient({ listItems }: Props) {
  const router = useRouter()
  const supabase = createClient()

  // 선택된 ID 집합 (개별 문제 ID 또는 세트 groupId)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  function toggleItem(key: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === listItems.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(listItems.map(item =>
        item.kind === 'set' ? item.groupId : item.question.id
      )))
    }
  }

  // 세트 전체 삭제 (groupId 기준)
  async function deleteSet(groupId: string) {
    if (!confirm('이 세트의 모든 문제를 삭제하시겠습니까?')) return
    setDeleting(true)
    const { error } = await supabase
      .from('questions')
      .update({ is_active: false })
      .eq('passage_group_id', groupId)
    if (error) { alert('삭제 실패: ' + error.message); setDeleting(false); return }
    setSelected(prev => { const n = new Set(prev); n.delete(groupId); return n })
    router.refresh()
    setDeleting(false)
  }

  // 선택 항목 일괄 삭제
  async function deleteSelected() {
    if (selected.size === 0) return
    if (!confirm(`선택한 ${selected.size}개 항목을 삭제하시겠습니까?`)) return
    setDeleting(true)

    // 선택된 항목에서 개별 문제 ID / 세트 groupId 분리
    const questionIds: string[] = []
    const groupIds: string[] = []
    for (const item of listItems) {
      if (item.kind === 'set' && selected.has(item.groupId)) {
        groupIds.push(item.groupId)
      } else if (item.kind === 'question' && selected.has(item.question.id)) {
        questionIds.push(item.question.id)
      }
    }

    const ops = []
    if (questionIds.length > 0) {
      ops.push(supabase.from('questions').update({ is_active: false }).in('id', questionIds).then(r => r))
    }
    for (const gid of groupIds) {
      ops.push(supabase.from('questions').update({ is_active: false }).eq('passage_group_id', gid).then(r => r))
    }

    const results = await Promise.all(ops)
    const err = results.find(r => r.error)
    if (err) { alert('일부 삭제 실패'); }

    setSelected(new Set())
    router.refresh()
    setDeleting(false)
  }

  const allSelected = listItems.length > 0 && selected.size === listItems.length

  return (
    <div>
      {/* 선택 툴바 */}
      <div className="flex items-center justify-between mb-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="w-4 h-4 rounded accent-blue-600"
          />
          <span className="text-sm text-gray-500">
            {selected.size > 0 ? `${selected.size}개 선택됨` : '전체 선택'}
          </span>
        </label>
        {selected.size > 0 && (
          <button
            onClick={deleteSelected}
            disabled={deleting}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {selected.size}개 삭제
          </button>
        )}
      </div>

      {/* 목록 */}
      <div className="space-y-2">
        {listItems.map(item => {
          if (item.kind === 'set') {
            const { groupId, questions: setQs } = item
            const rep = setQs[0]
            const diff = getDiffInfo(rep.difficulty)
            const isChecked = selected.has(groupId)
            return (
              <div key={groupId}
                className={`bg-white rounded-xl border shadow-sm p-4 flex items-start gap-3 transition group ${isChecked ? 'border-red-300 bg-red-50' : 'border-indigo-100 hover:border-indigo-300'}`}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleItem(groupId)}
                  className="mt-1 w-4 h-4 rounded accent-blue-600 flex-shrink-0 cursor-pointer"
                />
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${CATEGORY_COLORS[rep.category] ?? 'bg-gray-100 text-gray-600'}`}>
                  {CATEGORY_ICON[rep.category] ?? '📘'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[rep.category] ?? 'bg-gray-100 text-gray-600'}`}>
                      {CATEGORY_LABELS[rep.category] ?? rep.category}
                    </span>
                    {rep.subcategory && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap"># {rep.subcategory}</span>
                    )}
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${diff.color}`}>{diff.cefr} {diff.label}</span>
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold whitespace-nowrap">
                      <Layers size={10} /> {setQs.length}문제 세트
                    </span>
                    {setQs.some(q => q.audio_url) && <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 whitespace-nowrap">🎧 음성있음</span>}
                  </div>
                  {rep.summary ? (
                    <p className="text-sm text-gray-800 font-medium line-clamp-2">{rep.summary}</p>
                  ) : (
                    <p className="text-sm text-gray-500 italic line-clamp-2">{(rep.content ?? '').replace(/\n/g, ' ').slice(0, 120)}…</p>
                  )}
                  <p className="text-xs text-gray-300 mt-1 whitespace-nowrap overflow-hidden text-ellipsis">
                    {new Date(rep.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })} · {setQs.length}문제
                  </p>
                  {/* 모바일 전용 액션 버튼 (항상 표시) */}
                  <div className="flex sm:hidden gap-1.5 mt-2">
                    <Link href={`/teacher/questions/set/${groupId}`}
                      className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600"
                      title="세트 보기">
                      <Eye size={14} />
                    </Link>
                    <button
                      onClick={() => deleteSet(groupId)}
                      disabled={deleting}
                      className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-600 disabled:opacity-50"
                      title="세트 삭제">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {/* 데스크톱 전용 액션 버튼 (호버시 표시) */}
                <div className="hidden sm:flex gap-1.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                  <Link href={`/teacher/questions/set/${groupId}`}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition">
                    <Eye size={12} /> 세트 보기
                  </Link>
                  <button
                    onClick={() => deleteSet(groupId)}
                    disabled={deleting}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition disabled:opacity-50"
                  >
                    <Trash2 size={12} /> 세트 삭제
                  </button>
                </div>
              </div>
            )
          }

          const iq = item.question
          const diff = getDiffInfo(iq.difficulty)
          const isChecked = selected.has(iq.id)
          return (
            <div key={iq.id}
              className={`bg-white rounded-xl border shadow-sm p-4 flex items-start gap-3 transition group ${isChecked ? 'border-red-300 bg-red-50' : 'border-gray-100 hover:border-blue-200'}`}>
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleItem(iq.id)}
                className="mt-1 w-4 h-4 rounded accent-blue-600 flex-shrink-0 cursor-pointer"
              />
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${CATEGORY_COLORS[iq.category] ?? 'bg-gray-100 text-gray-600'}`}>
                {CATEGORY_ICON[iq.category] ?? '📘'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[iq.category] ?? 'bg-gray-100 text-gray-600'}`}>
                    {CATEGORY_LABELS[iq.category] ?? iq.category}
                  </span>
                  {iq.subcategory && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap"># {iq.subcategory}</span>
                  )}
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${diff.color}`}>{diff.cefr} {diff.label}</span>
                  {iq.audio_url && <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 whitespace-nowrap">🎧 음성있음</span>}
                  {iq.source === 'ai_generated' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium whitespace-nowrap">AI생성</span>
                  )}
                </div>
                {iq.summary ? (
                  <p className="text-sm text-gray-800 font-medium line-clamp-2">{iq.summary}</p>
                ) : (
                  <p className="text-sm text-gray-700 line-clamp-2">{iq.content}</p>
                )}
                <p className="text-xs text-gray-300 mt-1 whitespace-nowrap overflow-hidden text-ellipsis">
                  {new Date(iq.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
                  {iq.attempt_count > 0 && ` · 정답률 ${Math.round((iq.correct_count / iq.attempt_count) * 100)}% · 출제 ${iq.attempt_count}회`}
                </p>
                {/* 모바일 전용 액션 버튼 (항상 표시) */}
                <div className="flex sm:hidden gap-1.5 mt-2">
                  <Link href={`/teacher/questions/${iq.id}`}
                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600"
                    title="미리보기">
                    <Eye size={14} />
                  </Link>
                  <Link href={`/teacher/questions/${iq.id}/edit`}
                    className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-600"
                    title="수정">
                    <Pencil size={14} />
                  </Link>
                  <CopyButton question={iq} iconOnly />
                  <DeleteButton id={iq.id} iconOnly />
                </div>
              </div>
              {/* 데스크톱 전용 액션 버튼 (호버시 표시) */}
              <div className="hidden sm:flex gap-1.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                <Link href={`/teacher/questions/${iq.id}`}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition">
                  <Eye size={12} /> 미리보기
                </Link>
                <Link href={`/teacher/questions/${iq.id}/edit`}
                  className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                  수정
                </Link>
                <CopyButton question={iq} />
                <DeleteButton id={iq.id} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DeleteButton({ id, iconOnly }: { id: string; iconOnly?: boolean }) {
  const router = useRouter()
  const supabase = createClient()
  const [state, setState] = useState<'idle' | 'loading'>('idle')

  async function handleDelete() {
    if (!confirm('이 문제를 삭제하시겠습니까?')) return
    setState('loading')
    const { error } = await supabase.from('questions').update({ is_active: false }).eq('id', id)
    if (error) { alert('삭제 실패: ' + error.message); setState('idle'); return }
    router.refresh()
  }

  if (iconOnly) {
    return (
      <button onClick={handleDelete} disabled={state === 'loading'} title="삭제"
        className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-600 disabled:opacity-50">
        {state === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
      </button>
    )
  }

  return (
    <button onClick={handleDelete} disabled={state === 'loading'}
      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition disabled:opacity-50">
      {state === 'loading' ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
      삭제
    </button>
  )
}
