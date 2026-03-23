'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, BookOpen, Edit2, Trash2, Eye, EyeOff, X, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Content {
  id: string
  title: string
  category: string | null
  class_id: string | null
  is_published: boolean
  created_at: string
  content: string
}

interface Props {
  contents: Content[]
  classes: { id: string; name: string }[]
}

const CATEGORIES = ['문법', '독해', '어휘', '듣기', '쓰기', '회화', '기타']

export default function ContentsClient({ contents: initialContents, classes }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [contents, setContents] = useState(initialContents)

  // 서버에서 새 데이터가 오면 state 동기화
  useEffect(() => {
    setContents(initialContents)
  }, [initialContents])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Content | null>(null)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<Content | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [classId, setClassId] = useState('')
  const [contentText, setContentText] = useState('')
  const [isPublished, setIsPublished] = useState(false)

  function openNew() {
    setEditing(null)
    setTitle('')
    setCategory('')
    setClassId('')
    setContentText('')
    setIsPublished(false)
    setShowForm(true)
  }

  function openEdit(c: Content) {
    setEditing(c)
    setTitle(c.title)
    setCategory(c.category ?? '')
    setClassId(c.class_id ?? '')
    setContentText(c.content)
    setIsPublished(c.is_published)
    setShowForm(true)
  }

  async function save() {
    if (!title.trim()) return alert('제목을 입력해주세요')
    if (!contentText.trim()) return alert('내용을 입력해주세요')
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return alert('로그인이 필요합니다') }

    const payload = {
      teacher_id: user.id,
      title: title.trim(),
      category: category || null,
      class_id: classId || null,
      content: contentText.trim(),
      is_published: isPublished,
    }

    if (editing) {
      const { error } = await supabase.from('learning_contents').update(payload).eq('id', editing.id)
      if (error) { setSaving(false); return alert('수정 실패: ' + error.message) }
    } else {
      const { error } = await supabase.from('learning_contents').insert(payload)
      if (error) { setSaving(false); return alert('저장 실패: ' + error.message) }
    }

    setSaving(false)
    setShowForm(false)
    router.refresh()
  }

  async function deleteContent(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await supabase.from('learning_contents').delete().eq('id', id)
    setContents(prev => prev.filter(c => c.id !== id))
  }

  async function togglePublish(c: Content) {
    await supabase.from('learning_contents').update({ is_published: !c.is_published }).eq('id', c.id)
    setContents(prev => prev.map(x => x.id === c.id ? { ...x, is_published: !x.is_published } : x))
  }

  return (
    <div className="p-7">
      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">📚 학습 자료</h1>
          <p className="text-gray-500 text-sm mt-1">학생들에게 공유할 자료를 작성하세요</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition shadow-sm"
        >
          <Plus size={16} />
          새 자료 작성
        </button>
      </div>

      {/* 작성/수정 폼 */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-blue-200 shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-extrabold text-gray-900">{editing ? '자료 수정' : '새 자료 작성'}</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="col-span-3">
              <label className="text-xs font-bold text-gray-500 mb-1 block">제목 *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="자료 제목을 입력하세요"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">영역</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">선택 안함</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">대상 반</label>
              <select
                value={classId}
                onChange={e => setClassId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">전체 공개</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer pb-1">
                <div
                  onClick={() => setIsPublished(!isPublished)}
                  className={`w-10 h-5 rounded-full transition-colors ${isPublished ? 'bg-blue-500' : 'bg-gray-200'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full mt-0.5 transition-transform shadow ${isPublished ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm font-semibold text-gray-700">바로 공개</span>
              </label>
            </div>
          </div>

          <div className="mb-5">
            <label className="text-xs font-bold text-gray-500 mb-1 block">내용 * (마크다운 지원)</label>
            <textarea
              value={contentText}
              onChange={e => setContentText(e.target.value)}
              rows={12}
              placeholder={`# 제목\n\n내용을 마크다운으로 작성하세요.\n\n**굵게**, *기울임*, \`코드\` 등 사용 가능`}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
            >
              취소
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50"
            >
              {saving ? '저장 중...' : <><Check size={15} /> 저장</>}
            </button>
          </div>
        </div>
      )}

      {/* 자료 목록 */}
      {contents.length === 0 && !showForm ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
          <BookOpen size={48} className="mx-auto text-gray-200 mb-4" />
          <p className="font-semibold text-gray-500">작성된 학습 자료가 없어요</p>
          <p className="text-sm text-gray-400 mt-1">새 자료 작성 버튼을 눌러 시작하세요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contents.map(c => {
            const cls = classes.find(x => x.id === c.class_id)
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <BookOpen size={20} className="text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-gray-900 text-sm">{c.title}</h3>
                    {c.category && (
                      <span className="text-xs bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full">
                        {c.category}
                      </span>
                    )}
                    {cls ? (
                      <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
                        {cls.name}
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full">
                        전체 공개
                      </span>
                    )}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.is_published ? '공개' : '비공개'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-1">{c.content.replace(/[#*`]/g, '').trim()}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setPreview(c)}
                    className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition"
                    title="미리보기"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => togglePublish(c)}
                    className={`p-2 rounded-lg transition ${c.is_published ? 'text-emerald-500 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-50'}`}
                    title={c.is_published ? '비공개로 전환' : '공개로 전환'}
                  >
                    {c.is_published ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button
                    onClick={() => openEdit(c)}
                    className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition"
                    title="수정"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => deleteContent(c.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    title="삭제"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 미리보기 모달 */}
      {preview && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="font-extrabold text-gray-900">{preview.title}</h2>
                <div className="flex gap-2 mt-1">
                  {preview.category && <span className="text-xs bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full">{preview.category}</span>}
                </div>
              </div>
              <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto prose prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{preview.content}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
