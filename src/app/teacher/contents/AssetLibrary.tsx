'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Music, BookOpen, X, Tag, Trash2, Play, FileText, Search } from 'lucide-react'
import { saveAsset, deleteAsset } from './actions'

interface Asset {
  id: string
  asset_type: string
  title: string
  tags: string[]
  file_url: string | null
  transcript: string | null
  created_at: string
  metadata: Record<string, unknown> | null
}

const TYPE_LABELS: Record<string, { label: string; icon: typeof Music; color: string }> = {
  audio:   { label: '오디오',  icon: Music,     color: 'bg-amber-100 text-amber-700' },
  reading: { label: '리딩 지문', icon: BookOpen,  color: 'bg-blue-100 text-blue-700' },
}

export default function AssetLibrary({ initialAssets }: { initialAssets: Asset[] }) {
  const supabase = createClient()
  const [assets, setAssets] = useState(initialAssets)
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Upload form state
  const [assetType, setAssetType] = useState<'audio' | 'reading'>('audio')
  const [title, setTitle] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [transcript, setTranscript] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  // Filter state
  const [filterType, setFilterType] = useState<'all' | 'audio' | 'reading'>('all')
  const [searchTag, setSearchTag] = useState('')
  const [playingId, setPlayingId] = useState<string | null>(null)

  function addTag(raw: string) {
    const t = raw.trim().replace(/^#/, '')
    if (t && !tags.includes(t)) setTags(prev => [...prev, t])
    setTagInput('')
  }

  function resetForm() {
    setTitle(''); setTags([]); setTagInput(''); setTranscript(''); setAudioFile(null)
    setAssetType('audio')
  }

  async function handleSave() {
    if (!title.trim()) return alert('제목을 입력하세요')
    if (assetType === 'reading' && !transcript.trim()) return alert('지문 내용을 입력하세요')
    if (assetType === 'audio' && !audioFile && !transcript.trim()) return alert('오디오 파일 또는 스크립트를 입력하세요')
    setSaving(true)

    let fileUrl: string | null = null

    // Upload audio file to Supabase storage
    if (assetType === 'audio' && audioFile) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSaving(false); return alert('로그인이 필요합니다') }
      const fileName = `assets/${user.id}_${Date.now()}.mp3`
      const { error: uploadErr } = await supabase.storage
        .from('question-audio').upload(fileName, audioFile, { contentType: 'audio/mpeg', upsert: true })
      if (uploadErr) { setSaving(false); return alert('파일 업로드 실패: ' + uploadErr.message) }
      const { data: urlData } = supabase.storage.from('question-audio').getPublicUrl(fileName)
      fileUrl = urlData.publicUrl
    }

    const result = await saveAsset({
      asset_type: assetType, title: title.trim(), tags,
      file_url: fileUrl, transcript: transcript.trim() || null,
    })

    setSaving(false)
    if (result.error) return alert('저장 실패: ' + result.error)

    setAssets(prev => [{
      id: result.id!, asset_type: assetType, title: title.trim(),
      tags, file_url: fileUrl, transcript: transcript.trim() || null,
      created_at: new Date().toISOString(), metadata: null,
    }, ...prev])
    resetForm(); setShowForm(false)
  }

  function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    startTransition(async () => {
      await deleteAsset(id)
      setAssets(prev => prev.filter(a => a.id !== id))
    })
  }

  const filtered = assets.filter(a => {
    if (filterType !== 'all' && a.asset_type !== filterType) return false
    if (searchTag.trim()) {
      const q = searchTag.trim().toLowerCase()
      return a.tags.some(t => t.toLowerCase().includes(q)) ||
             a.title.toLowerCase().includes(q)
    }
    return true
  })

  // Collect all unique tags for quick filter chips
  const allTags = [...new Set(assets.flatMap(a => a.tags))].slice(0, 20)

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Type filter */}
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {(['all', 'audio', 'reading'] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${filterType === t ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
              {t === 'all' ? '전체' : TYPE_LABELS[t].label}
            </button>
          ))}
        </div>

        {/* Tag search */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 flex-1 max-w-64">
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input value={searchTag} onChange={e => setSearchTag(e.target.value)}
            placeholder="태그 또는 제목 검색..." className="text-xs text-gray-900 flex-1 focus:outline-none" />
        </div>

        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition ml-auto">
          <Plus size={14} /> 자료 추가
        </button>
      </div>

      {/* Quick tag chips */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {allTags.map(tag => (
            <button key={tag} onClick={() => setSearchTag(searchTag === tag ? '' : tag)}
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full transition ${searchTag === tag ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Upload form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-blue-200 shadow-md p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">새 자료 추가</h3>
            <button onClick={() => { setShowForm(false); resetForm() }}><X size={18} className="text-gray-400" /></button>
          </div>

          {/* Type selector */}
          <div className="flex gap-3 mb-4">
            {(['audio', 'reading'] as const).map(t => {
              const info = TYPE_LABELS[t]
              const Icon = info.icon
              return (
                <button key={t} onClick={() => setAssetType(t)}
                  className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition ${assetType === t ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}>
                  <Icon size={16} className={assetType === t ? 'text-blue-600' : 'text-gray-400'} />
                  <span className={`text-sm font-bold ${assetType === t ? 'text-blue-700' : 'text-gray-500'}`}>{info.label}</span>
                </button>
              )
            })}
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">제목 *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 기숙사 층간소음 대화 (Band 3.0)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>

            {/* Tags */}
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">태그</label>
              <div className="flex flex-wrap gap-1.5 p-2 border border-gray-200 rounded-xl min-h-[42px]">
                {tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                    #{tag}
                    <button onClick={() => setTags(prev => prev.filter(t => t !== tag))}><X size={10} /></button>
                  </span>
                ))}
                <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) } }}
                  placeholder={tags.length === 0 ? "태그 입력 후 Enter (예: band_3.0, 생물학)" : ''}
                  className="text-xs text-gray-900 flex-1 min-w-24 focus:outline-none bg-transparent" />
              </div>
              <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1"><Tag size={10} /> band_3.0, 생물학, 리스닝 등 자유롭게 입력</p>
            </div>

            {/* Audio file */}
            {assetType === 'audio' && (
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">오디오 파일 (MP3)</label>
                <input type="file" accept="audio/mpeg,audio/mp3" onChange={e => setAudioFile(e.target.files?.[0] ?? null)}
                  className="w-full text-xs text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-600 file:font-semibold file:text-xs hover:file:bg-blue-100" />
              </div>
            )}

            {/* Transcript / Passage */}
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">
                {assetType === 'audio' ? '스크립트 (선택)' : '지문 내용 *'}
              </label>
              <textarea value={transcript} onChange={e => setTranscript(e.target.value)}
                rows={assetType === 'reading' ? 8 : 5}
                placeholder={assetType === 'audio' ? 'A: Hello...\nB: Hi there...' : '지문 텍스트를 입력하세요...'}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => { setShowForm(false); resetForm() }}
              className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition">
              취소
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {/* Asset list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
          <FileText size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="font-semibold text-gray-500">{assets.length === 0 ? '에셋이 없어요' : '검색 결과가 없어요'}</p>
          <p className="text-sm text-gray-400 mt-1">오디오 파일이나 리딩 지문을 추가해보세요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(asset => {
            const info = TYPE_LABELS[asset.asset_type] ?? TYPE_LABELS.reading
            const Icon = info.icon
            return (
              <div key={asset.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${info.color}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{asset.title}</p>
                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {asset.tags.map(tag => (
                      <span key={tag} className="text-[10px] bg-gray-100 text-gray-600 font-semibold px-1.5 py-0.5 rounded-full">#{tag}</span>
                    ))}
                  </div>
                  {/* Transcript preview */}
                  {asset.transcript && (
                    <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{asset.transcript}</p>
                  )}
                  {/* Audio player */}
                  {asset.file_url && asset.asset_type === 'audio' && playingId === asset.id && (
                    <audio src={asset.file_url} autoPlay controls className="mt-2 h-8 w-full" onEnded={() => setPlayingId(null)} />
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {asset.file_url && asset.asset_type === 'audio' && (
                    <button onClick={() => setPlayingId(playingId === asset.id ? null : asset.id)}
                      className="p-2 rounded-lg text-amber-500 hover:bg-amber-50 transition" title="재생">
                      <Play size={15} />
                    </button>
                  )}
                  <button onClick={() => handleDelete(asset.id)} disabled={isPending}
                    className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-50" title="삭제">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
