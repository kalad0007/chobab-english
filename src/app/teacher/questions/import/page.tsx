'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, UploadCloud, File, Image as ImageIcon, Check, Loader2, X } from 'lucide-react'

interface GeneratedQuestion {
  content: string
  passage?: string | null
  options: { num: number; text: string }[] | null
  answer: string
  explanation: string
  category: string
  difficulty: number
}

export default function ImportQuestionsPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFileSelect(dropped)
  }

  function handleFileSelect(selectedFile: File) {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(selectedFile.type)) {
      setError('지원하지 않는 형식입니다. PDF 또는 이미지 파일(JPG, PNG)만 올려주세요.')
      return
    }
    setFile(selectedFile)
    setError('')
    setQuestions([])
    setSelected(new Set())
  }

  async function handleImport() {
    if (!file) return
    setLoading(true)
    setError('')
    setQuestions([])
    setSelected(new Set())

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/ai/import', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || '문제 추출에 실패했습니다.')
      }

      const data = await res.json()
      setQuestions(data.questions)
      setSelected(new Set(data.questions.map((_: GeneratedQuestion, i: number) => i)))
    } catch (err: any) {
      setError(err.message || '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    const toSave = questions.filter((_, i) => selected.has(i))

    const res = await fetch('/api/ai/save-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: toSave }),
    })

    if (res.ok) {
      router.push('/teacher/questions')
      router.refresh()
    } else {
      setError('문제 저장에 실패했습니다.')
      setSaving(false)
    }
  }

  return (
    <div className="p-7 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-1.5 rounded-full text-sm font-bold mb-3">
          <BookOpen size={14} /> AI 스캔 및 PDF 등록
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900">문제 문서 파일로 자동 추출하기</h1>
        <p className="text-gray-500 text-sm mt-1">
          시험지 사진, 화면 캡쳐 이미지, 또는 PDF 파일을 업로드하면 AI가 자동으로 문제를 읽고 데이터베이스에 저장할 수 있게 변환해 드립니다.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        {!file ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            className="border-2 border-dashed border-gray-300 rounded-2xl p-10 flex flex-col items-center justify-center text-center hover:bg-gray-50 transition cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4">
              <UploadCloud size={32} />
            </div>
            <h3 className="font-bold text-gray-800 text-lg">파일을 여기로 드래그 하세요</h3>
            <p className="text-gray-500 text-sm mt-2 mb-4">
              또는 클릭하여 내 PC에서 파일 선택 (PDF, JPG, PNG)
            </p>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const selected = e.target.files?.[0]
                if (selected) handleFileSelect(selected)
              }}
            />
            <button className="px-5 py-2.5 bg-gray-900 text-white font-semibold text-sm rounded-xl">
              파일 선택하기
            </button>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                  {file.type === 'application/pdf' ? <File size={24} /> : <ImageIcon size={24} />}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-sm">{file.name}</h3>
                  <p className="text-gray-500 text-xs mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              {!loading && (
                <button
                  onClick={() => { setFile(null); setQuestions([]); setError('') }}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200 mt-4">{error}</div>}

            {questions.length === 0 && (
              <button
                onClick={handleImport}
                disabled={loading}
                className="w-full mt-5 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition text-sm shadow-md"
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> 파일을 분석 중입니다. 최대 1분 정도 소요될 수 있습니다...</> : <><BookOpen size={16} /> 문제 자동 추출하기</>}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 추출된 문제 목록 */}
      {questions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900">총 {questions.length}개 문제 추출 완료</h2>
            <button
              onClick={() => setSelected(selected.size === questions.length ? new Set() : new Set(questions.map((_, i) => i)))}
              className="text-sm text-emerald-600 font-medium hover:underline"
            >
              {selected.size === questions.length ? '전체 해제' : '전체 선택'}
            </button>
          </div>

          <div className="space-y-3 mb-5">
            {questions.map((q, i) => (
              <div
                key={i}
                onClick={() => {
                  const next = new Set(selected)
                  if (next.has(i)) next.delete(i)
                  else next.add(i)
                  setSelected(next)
                }}
                className={`bg-white rounded-xl border-2 p-5 cursor-pointer transition ${selected.has(i) ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 hover:border-emerald-200'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${selected.has(i) ? 'bg-emerald-600' : 'bg-gray-200'}`}>
                    {selected.has(i) && <Check size={14} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                       <span className="text-xs font-bold px-2 py-0.5 bg-white border border-gray-200 rounded text-gray-600">
                         {q.category.toUpperCase()}
                       </span>
                       <span className="text-xs text-gray-500">난이도: {q.difficulty}</span>
                    </div>

                    {q.passage && (
                      <div className="bg-white/50 border-l-2 border-emerald-300 p-3 rounded text-sm text-gray-700 mb-3 whitespace-pre-wrap">
                        {q.passage}
                      </div>
                    )}
                    
                    <p className="text-sm font-bold text-gray-900 mb-3">{q.content}</p>
                    
                    {q.options && q.options.length > 0 && (
                      <div className="pl-2 border-l-2 border-gray-200 mb-3 space-y-1">
                        {q.options.map(opt => (
                          <p key={opt.num} className="text-sm text-gray-700">
                            <span className="font-bold text-gray-500 w-5 inline-block">{opt.num}.</span> {opt.text}
                          </p>
                        ))}
                      </div>
                    )}
                    
                    <div className="bg-white rounded-lg p-3 border border-emerald-100 mt-3">
                      <p className="text-sm">
                        <span className="font-bold text-emerald-700 mr-2">정답:</span>
                        <span className="text-gray-800 font-semibold">{q.answer}</span>
                      </p>
                      {q.explanation && (
                        <p className="text-sm text-gray-600 mt-1 mt-1 border-t border-emerald-50 pt-1">
                          {q.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleSave}
            disabled={saving || selected.size === 0}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold py-3.5 rounded-xl transition text-base shadow-lg"
          >
            {saving ? <><Loader2 size={18} className="animate-spin" /> 저장 중...</> : `선택한 ${selected.size}개 문제 문제은행에 등록하기`}
          </button>
        </div>
      )}
    </div>
  )
}
