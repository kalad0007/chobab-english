'use client'

import { useState, useEffect } from 'react'
import { RotateCcw, CheckCircle, XCircle } from 'lucide-react'

interface Props {
  personAQuestion: string
  wordTiles: { num: number; text: string }[]
  value?: string
  onChange?: (answer: string) => void
  readonly?: boolean
  correctAnswer?: string
  explanation?: string
  // 시험 중 "확인" 모드 — 제출 후 결과 표시 + 재도전 가능
  showCheck?: boolean
}

export default function BuildASentencePlayer({
  personAQuestion,
  wordTiles,
  value = '',
  onChange,
  readonly = false,
  correctAnswer,
  explanation,
  showCheck = false,
}: Props) {
  const [selected, setSelected] = useState<number[]>([])
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!value) { setSelected([]); setChecked(false) }
  }, [value])

  const selectedWords = selected.map(i => wordTiles[i].text)
  const assembledSentence = selectedWords.join(' ')

  function handleTileClick(idx: number) {
    if (readonly || checked) return
    const next = [...selected, idx]
    setSelected(next)
    onChange?.(next.map(i => wordTiles[i].text).join(' '))
  }

  function handleRemoveWord(pos: number) {
    if (readonly || checked) return
    const next = selected.filter((_, i) => i !== pos)
    setSelected(next)
    onChange?.(next.map(i => wordTiles[i].text).join(' '))
  }

  function handleRetry() {
    setSelected([])
    setChecked(false)
    onChange?.('')
  }

  const usedSet = new Set(selected)

  // 정답 비교: 단어별 정오 표시
  const correctWords = correctAnswer?.trim().split(/\s+/) ?? []
  const studentWords = assembledSentence.trim().split(/\s+/).filter(Boolean)
  const isFullyCorrect = correctAnswer
    ? assembledSentence.trim().toLowerCase() === correctAnswer.trim().toLowerCase()
    : false

  const showResult = readonly || (showCheck && checked)

  return (
    <div className="space-y-5">
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

        {/* Person B — 조립 영역 */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-lg flex-shrink-0 border-2 border-blue-200">
            👨
          </div>
          <div className="flex-1">
            <div className={`min-h-[44px] flex flex-wrap gap-1.5 items-center rounded-2xl rounded-tl-none px-3 py-2 border-2 ${
              showResult
                ? isFullyCorrect
                  ? 'bg-emerald-50 border-emerald-300'
                  : 'bg-red-50 border-red-200'
                : 'bg-white border-dashed border-gray-300'
            }`}>
              {selected.length === 0 ? (
                <span className="text-gray-300 text-sm italic">단어를 클릭해서 문장을 완성하세요...</span>
              ) : showResult && correctAnswer ? (
                // 결과 모드: 단어별 정오 색상 하이라이트
                studentWords.map((word, pos) => {
                  const isWordCorrect = correctWords[pos]?.toLowerCase() === word.toLowerCase()
                  return (
                    <span key={pos}
                      className={`px-3 py-1 rounded-lg text-sm font-medium border ${
                        isWordCorrect
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                          : 'bg-red-100 border-red-300 text-red-700 line-through'
                      }`}>
                      {word}
                    </span>
                  )
                })
              ) : (
                selectedWords.map((word, pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => handleRemoveWord(pos)}
                    disabled={readonly || checked}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition border ${
                      readonly || checked
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

      {/* 결과 패널 */}
      {showResult && correctAnswer && (
        <div className={`rounded-xl px-4 py-3 space-y-2 ${isFullyCorrect ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center gap-2">
            {isFullyCorrect
              ? <><CheckCircle size={16} className="text-emerald-600" /><span className="text-sm font-bold text-emerald-800">정답입니다! 🎉</span></>
              : <><XCircle size={16} className="text-red-500" /><span className="text-sm font-bold text-red-700">오답입니다.</span></>
            }
          </div>
          {!isFullyCorrect && (
            <div>
              <p className="text-xs font-bold text-gray-500 mb-1">정답</p>
              <div className="flex flex-wrap gap-1.5">
                {correctWords.map((w, i) => (
                  <span key={i} className="px-3 py-1 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg text-sm font-medium">{w}</span>
                ))}
              </div>
            </div>
          )}
          {explanation && (
            <p className="text-xs text-gray-600 bg-white/70 rounded-lg px-3 py-2">{explanation}</p>
          )}
        </div>
      )}

      {/* 단어 풀 */}
      {!showResult && (
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

      {/* 확인 버튼 (showCheck 모드, 미확인 상태) */}
      {showCheck && !checked && selected.length > 0 && !readonly && (
        <button
          type="button"
          onClick={() => setChecked(true)}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition">
          확인하기
        </button>
      )}

      {/* 재도전 버튼 (결과 확인 후, showCheck 모드) */}
      {showCheck && checked && !isFullyCorrect && (
        <button
          type="button"
          onClick={handleRetry}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border-2 border-blue-300 text-blue-700 rounded-xl text-sm font-bold hover:bg-blue-50 transition">
          <RotateCcw size={14} /> 다시 도전
        </button>
      )}

      {/* readonly 모드: 단어 풀 재표시 */}
      {showResult && !readonly && !checked && correctAnswer && (
        <div className="border-t border-gray-100 pt-4">
          <div className="flex flex-wrap gap-2 justify-center opacity-40">
            {wordTiles.map((tile, idx) => (
              <span key={idx} className="px-4 py-2 rounded-lg text-sm font-medium border-2 bg-gray-50 border-gray-100 text-gray-300">
                {tile.text}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
