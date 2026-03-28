'use client'

import { useState } from 'react'
import { Library, LayoutGrid, Sparkles } from 'lucide-react'
import AssetLibrary from './AssetLibrary'
import TemplateVault from './TemplateVault'
import AIConverter from './AIConverter'

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

interface Props {
  assets: Asset[]
  questionCounts: Record<string, number>
}

const TABS = [
  { id: 'assets',    label: '에셋 라이브러리',  icon: Library,    desc: '오디오 파일 · 리딩 지문 원천 자료실' },
  { id: 'templates', label: '템플릿 보관함',     icon: LayoutGrid, desc: '13대 유형별 문제 출제 허브' },
  { id: 'ai',        label: 'AI 스마트 변환기',  icon: Sparkles,   desc: '텍스트·키워드 → 문제·오디오 자동 생성' },
] as const

type TabId = typeof TABS[number]['id']

export default function ContentsClient({ assets, questionCounts }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('assets')

  return (
    <div className="p-4 md:p-7">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">🏭 스마트 자료 공장</h1>
        <p className="text-gray-500 text-sm mt-1">에셋 관리 · 문제 유형 템플릿 · AI 자동 생성</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-gray-100">
        {TABS.map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-bold rounded-t-xl border-b-2 transition ${
                active
                  ? 'text-blue-600 border-blue-600 bg-blue-50'
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
              }`}>
              <Icon size={16} className={active ? 'text-blue-600' : 'text-gray-400'} />
              {tab.label}
            </button>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 mb-5">{TABS.find(t => t.id === activeTab)?.desc}</p>

      {activeTab === 'assets'    && <AssetLibrary initialAssets={assets} />}
      {activeTab === 'templates' && <TemplateVault questionCounts={questionCounts} />}
      {activeTab === 'ai'        && <AIConverter />}
    </div>
  )
}
