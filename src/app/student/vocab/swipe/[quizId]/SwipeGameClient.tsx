'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Star, X } from 'lucide-react'

interface GameItem {
  id: string
  collocation: string
  word: string
  part_of_speech: string
  definition_ko: string
}

interface Props {
  quizTitle: string
  items: GameItem[]
}

function extractPartner(word: string, collocation: string): string {
  return collocation.replace(new RegExp(`\\b${word}\\b`, 'gi'), '').replace(/\s+/g, ' ').trim()
}

export default function SwipeGameClient({ quizTitle, items }: Props) {
  const router = useRouter()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [coins, setCoins] = useState(0)
  const [phase, setPhase] = useState<'playing' | 'wrong' | 'result'>('playing')
  const [wrongInfo, setWrongInfo] = useState<{ correct: string; collocation: string } | null>(null)
  const [btnSwap, setBtnSwap] = useState(false)

  const currentItem = items[currentIndex]

  const partner = useMemo(
    () => extractPartner(currentItem.word, currentItem.collocation),
    [currentItem]
  )

  const distractor = useMemo(() => {
    const otherPartners = items
      .filter((_, i) => i !== currentIndex)
      .map(item => extractPartner(item.word, item.collocation))
      .filter(p => p !== partner && p.length > 0)

    return otherPartners[Math.floor(Math.random() * otherPartners.length)] ?? 'do'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, items])

  const leftChoice = btnSwap ? distractor : partner
  const rightChoice = btnSwap ? partner : distractor

  function nextQuestion() {
    if (currentIndex + 1 >= items.length) {
      setPhase('result')
    } else {
      setCurrentIndex(prev => prev + 1)
      setBtnSwap(Math.random() > 0.5)
    }
  }

  function handleAnswer(chosen: string) {
    const correct = partner
    if (chosen === correct) {
      const newCombo = combo + 1
      setCombo(newCombo)
      setMaxCombo(prev => Math.max(prev, newCombo))
      setCorrectCount(prev => prev + 1)
      const multiplier = newCombo >= 10 ? 3 : newCombo >= 5 ? 2 : 1
      setCoins(prev => prev + 10 * multiplier)
      nextQuestion()
    } else {
      setCombo(0)
      setWrongInfo({ correct: partner, collocation: currentItem.collocation })
      setPhase('wrong')
    }
  }

  function handleWrongClose() {
    setPhase('playing')
    nextQuestion()
  }

  function handleRestart() {
    setCurrentIndex(0)
    setCombo(0)
    setMaxCombo(0)
    setCorrectCount(0)
    setCoins(0)
    setPhase('playing')
    setWrongInfo(null)
    setBtnSwap(Math.random() > 0.5)
  }

  // 결과 화면
  if (phase === 'result') {
    const accuracy = Math.round((correctCount / items.length) * 100)
    const starCount = accuracy === 100 ? 3 : accuracy >= 70 ? 2 : 1
    const grade = accuracy === 100 ? 'S' : accuracy >= 70 ? 'A' : 'B'

    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-900 to-purple-900 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-3xl p-8 text-center shadow-2xl">
          <div className="flex justify-center gap-1 mb-4">
            {[1, 2, 3].map(i => (
              <Star
                key={i}
                size={32}
                className={i <= starCount ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}
              />
            ))}
          </div>
          <div className="w-20 h-20 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-extrabold text-2xl">{grade}</span>
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 mb-1">
            {starCount === 3 ? 'Word Master!' : starCount === 2 ? 'Great Job!' : 'Keep Going!'}
          </h2>
          <p className="text-sm text-gray-500 mb-6">{quizTitle}</p>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-gray-50 rounded-2xl p-3">
              <p className="text-[10px] text-gray-400 font-bold uppercase">정답</p>
              <p className="text-2xl font-extrabold text-gray-900">{correctCount}</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-3">
              <p className="text-[10px] text-gray-400 font-bold uppercase">콤보</p>
              <p className="text-2xl font-extrabold text-gray-900">{maxCombo}</p>
            </div>
            <div className="bg-yellow-50 rounded-2xl p-3">
              <p className="text-[10px] text-yellow-600 font-bold uppercase">코인</p>
              <p className="text-2xl font-extrabold text-yellow-600">{coins}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleRestart}
              className="w-full py-3 bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-extrabold rounded-2xl"
            >
              ▶ 다시 하기
            </button>
            <button
              onClick={() => router.push('/student/vocab')}
              className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-2xl"
            >
              단어장으로
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-indigo-900 flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 pt-safe pt-4 pb-2">
          <button onClick={() => router.back()} className="text-white/60 hover:text-white">
            <X size={20} />
          </button>
          <p className="text-white/80 text-xs font-semibold truncate max-w-[200px]">{quizTitle}</p>
          <div className="flex items-center gap-1 bg-yellow-400 text-yellow-900 font-bold text-sm px-3 py-1 rounded-full">
            <Star size={13} fill="currentColor" /> {coins}
          </div>
        </div>

        {/* 콤보 */}
        {combo >= 3 && (
          <div className="text-center py-1">
            <span className="text-yellow-300 font-extrabold text-lg animate-pulse">
              🔥 COMBO x{combo}
            </span>
          </div>
        )}

        {/* 카드 */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 text-center">
            <p className="text-[10px] font-extrabold text-purple-400 tracking-widest uppercase mb-4">
              Complete the Collocation
            </p>
            <p className="text-4xl font-extrabold text-gray-900 mb-2">{currentItem.word}</p>
            <div className="h-px bg-gray-200 mx-8 mb-3" />
            <p className="text-2xl font-bold text-purple-300 tracking-widest">_ _ _</p>
          </div>
        </div>

        {/* 버튼 2개 */}
        <div className="px-4 pb-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => handleAnswer(leftChoice)}
            className="h-20 rounded-2xl bg-cyan-400 hover:bg-cyan-300 active:scale-95 text-gray-900 font-extrabold text-xl shadow-lg transition-all"
          >
            {leftChoice}
          </button>
          <button
            onClick={() => handleAnswer(rightChoice)}
            className="h-20 rounded-2xl bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-gray-900 font-extrabold text-xl shadow-lg transition-all"
          >
            {rightChoice}
          </button>
        </div>

        {/* 진행 바 */}
        <div className="px-4 pb-8">
          <div className="flex items-center justify-between text-white/60 text-xs mb-1">
            <span>{currentIndex + 1} / {items.length}</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-300"
              style={{ width: `${(currentIndex / items.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* 오답 모달 */}
      {phase === 'wrong' && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl">
            <div className="text-4xl mb-3">💡</div>
            <h3 className="font-extrabold text-gray-900 text-lg mb-3">아쉬워요!</h3>
            <div className="bg-gray-50 rounded-2xl p-4 mb-4">
              <p className="text-sm text-gray-600">
                정답은 <span className="font-extrabold text-purple-600">"{wrongInfo?.correct}"</span>
              </p>
              <p className="text-sm font-bold text-gray-800 mt-1">
                → <span className="text-purple-700">{wrongInfo?.collocation}</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">{currentItem.definition_ko}</p>
            </div>
            <button
              onClick={handleWrongClose}
              className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-extrabold rounded-2xl"
            >
              OK!
            </button>
          </div>
        </div>
      )}
    </>
  )
}
