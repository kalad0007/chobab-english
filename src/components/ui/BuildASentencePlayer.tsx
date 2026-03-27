'use client'

import { useState, useEffect } from 'react'

interface Props {
  personAQuestion: string          // Person A의 질문 (content 필드)
  wordTiles: { num: number; text: string }[]  // 뒤섞인 단어 칩 (options 필드)
  value?: string                   // 현재 조립된 답안
  onChange?: (answer: string) => void
  readonly?: boolean               // 미리보기/채점 결과용
  correctAnswer?: string           // 정답 표시용 (readonly 모드)
}

export default function BuildASentencePlayer({
  personAQuestion,
  wordTiles,
  value = '',
  onChange,
  readonly = false,
  correctAnswer,
}: Props) {
  // selectedIndices: options 배열 인덱스 순서로 클릭된 단어를 추적
  const [selected, setSelected] = useState<number[]>([])

  // 외부 value가 바뀌면 (예: 초기화) 동기화
  useEffect(() => {
    if (!value) {
      setSelected([])
    }
  }, [value])

  const selectedWords = selected.map(i => wordTiles[i].text)
  const assembledSentence = selectedWords.join(' ')

  function handleTileClick(idx: number) {
    if (readonly) return
    const next = [...selected, idx]
    setSelected(next)
    onChange?.(next.map(i => wordTiles[i].text).join(' '))
  }

  function handleRemoveWord(pos: number) {
    if (readonly) return
    const next = selected.filter((_, i) => i !== pos)
    setSelected(next)
    onChange?.(next.map(i => wordTiles[i].text).join(' '))
  }

  const usedSet = new Set(selected)

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <p className="text-center font-bold text-gray-800 text-base">Make an appropriate sentence.</p>

      {/* 대화 영역 */}
      <div className="space-y-4">
        {/* Person A */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-lg flex-shrink-0 border-2 border-rose-200">
            👩
          </div>
          <div className="bg-gray-100 rounded-2xl rounded-tl-none px-4 py-2.5 text-sm text-gray-800 max-w-md">
            {personAQuestion}
          </div>
        </div>

        {/* Person B — 답 조립 영역 */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-lg flex-shrink-0 border-2 border-blue-200">
            👨
          </div>
          <div className="flex-1">
            {/* 조립된 단어들 (클릭하면 제거) */}
            <div className="min-h-[44px] flex flex-wrap gap-1.5 items-center bg-white border-2 border-dashed border-gray-300 rounded-2xl rounded-tl-none px-3 py-2">
              {selected.length === 0 ? (
                <span className="text-gray-300 text-sm italic">단어를 클릭해서 문장을 완성하세요...</span>
              ) : (
                selectedWords.map((word, pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => handleRemoveWord(pos)}
                    disabled={readonly}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition border ${
                      readonly
                        ? 'bg-blue-50 border-blue-200 text-blue-800 cursor-default'
                        : 'bg-blue-100 border-blue-300 text-blue-800 hover:bg-red-100 hover:border-red-300 hover:text-red-700'
                    }`}
                  >
                    {word}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 단어 풀 */}
      {!readonly && (
        <div className="border-t border-gray-100 pt-4">
          <div className="flex flex-wrap gap-2 justify-center">
            {wordTiles.map((tile, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleTileClick(idx)}
                disabled={usedSet.has(idx)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition ${
                  usedSet.has(idx)
                    ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-default'
                    : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                {tile.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* readonly 모드: 정답 표시 */}
      {readonly && correctAnswer && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <p className="text-xs font-bold text-green-700 mb-1">정답</p>
          <p className="text-sm text-green-800">{correctAnswer}</p>
        </div>
      )}
    </div>
  )
}
