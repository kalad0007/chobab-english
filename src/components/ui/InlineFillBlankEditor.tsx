'use client'

import { useState, useEffect, useCallback } from 'react'
import { RotateCcw, MousePointerClick } from 'lucide-react'

type Subtype = 'complete_the_words' | 'sentence_completion'

interface Props {
  subtype: Subtype
  content: string
  answer: string
  onChange: (content: string, answer: string) => void
}

type Piece =
  | { kind: 'word'; id: number; text: string; sentIdx: number }
  | { kind: 'gap';  text: string }

// wordId → hint chars to show (CTW only; SC always uses ___)
type HintMap = Map<number, number>

function defaultHint(text: string): number {
  return Math.min(text.length - 1, Math.max(1, Math.ceil(text.length / 3)))
}

function tokenize(text: string): Piece[] {
  const pieces: Piece[] = []
  let id = 0
  let sentIdx = 0
  const re = /([a-zA-Z']+)|([^a-zA-Z']+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m[1]) {
      pieces.push({ kind: 'word', id: id++, text: m[1], sentIdx })
    } else {
      const newlines = (m[2].match(/\n/g) || []).length
      pieces.push({ kind: 'gap', text: m[2] })
      sentIdx += newlines
    }
  }
  return pieces
}

function reconstruct(content: string, answer: string, subtype: Subtype): string {
  if (!content.trim()) return ''
  const words = answer.split(',').map(w => w.trim()).filter(Boolean)
  let idx = 0
  if (subtype === 'sentence_completion') {
    // Match optional leading letters + 2+ underscores (handles both ___ and te___ and _______ formats)
    return content.split('\n').map(line =>
      line.replace(/[a-zA-Z']*_{2,}/, () => words[idx++] ?? '___')
    ).join('\n')
  } else {
    return content.replace(/[a-zA-Z']*_{2,}/g, () => words[idx++] ?? '')
  }
}

function buildOutput(pieces: Piece[], hintMap: HintMap, subtype: Subtype): { content: string; answer: string } {
  const answerWords: string[] = []
  const scSentBlanked = new Set<number>()

  const maskedParts = pieces.map(p => {
    if (p.kind === 'gap') return p.text
    if (!hintMap.has(p.id)) return p.text
    answerWords.push(p.text)
    if (subtype === 'sentence_completion') {
      scSentBlanked.add(p.sentIdx)
      const n = hintMap.get(p.id) ?? defaultHint(p.text)
      return p.text.slice(0, n) + '_'.repeat(Math.max(2, p.text.length - n))
    } else {
      const n = hintMap.get(p.id)!
      return p.text.slice(0, n) + '_'.repeat(Math.max(2, p.text.length - n))
    }
  })

  return { content: maskedParts.join(''), answer: answerWords.join(',') }
}

function inferHintMap(pieces: Piece[], content: string, answer: string, subtype: Subtype): HintMap {
  const words = answer.split(',').map(w => w.trim()).filter(Boolean)
  const result: HintMap = new Map()
  if (!words.length) return result

  const wordPieces = pieces.filter((p): p is Extract<Piece, { kind: 'word' }> => p.kind === 'word')

  if (subtype === 'sentence_completion') {
    // Extract per-sentence hint lengths from content (e.g. "lea___" → 3, "___" → 0 → use default)
    const sentHintLengths = new Map<number, number>()
    content.split('\n').forEach((line, si) => {
      const m = line.match(/([a-zA-Z']*)(_{2,})/)
      if (m) sentHintLengths.set(si, m[1].length)
    })

    const perSent = new Map<number, string>()
    let sentIdx = 0
    words.forEach(w => { perSent.set(sentIdx++, w.toLowerCase()) })
    const usedSent = new Set<number>()
    wordPieces.forEach(p => {
      const target = perSent.get(p.sentIdx)
      if (target && !usedSent.has(p.sentIdx) && p.text.toLowerCase() === target) {
        const storedHint = sentHintLengths.get(p.sentIdx) ?? 0
        result.set(p.id, storedHint > 0 ? storedHint : defaultHint(p.text))
        usedSent.add(p.sentIdx)
      }
    })
  } else {
    // Extract hint lengths from the masked content (e.g. "pro____" → 3)
    const maskMatches = [...content.matchAll(/([a-zA-Z']+)(_{2,})/g)]
    let wi = 0
    wordPieces.forEach(p => {
      if (wi < words.length && p.text.toLowerCase() === words[wi].toLowerCase()) {
        const hintLen = maskMatches[wi] ? maskMatches[wi][1].length : defaultHint(p.text)
        result.set(p.id, hintLen)
        wi++
      }
    })
  }
  return result
}

export default function InlineFillBlankEditor({ subtype, content, answer, onChange }: Props) {
  const isSC = subtype === 'sentence_completion'

  const [rawText, setRawText] = useState(() => reconstruct(content, answer, subtype) || '')
  const [pieces, setPieces] = useState<Piece[]>(() => tokenize(rawText))
  const [hintMap, setHintMap] = useState<HintMap>(() => new Map())
  const [mode, setMode] = useState<'input' | 'select'>('input')

  useEffect(() => {
    if (content.trim()) {
      const raw = reconstruct(content, answer, subtype)
      const p = tokenize(raw)
      const h = inferHintMap(p, content, answer, subtype)
      setRawText(raw)
      setPieces(p)
      setHintMap(h)
      setMode('select')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleRawChange(text: string) {
    setRawText(text)
    setPieces(tokenize(text))
    setHintMap(new Map())
    onChange('', '')
  }

  function enterSelectMode() {
    if (!rawText.trim()) return
    const p = tokenize(rawText)
    setPieces(p)
    setHintMap(new Map())
    setMode('select')
    onChange('', '')
  }

  function backToInput() {
    setMode('input')
    setHintMap(new Map())
    onChange('', '')
  }

  const toggleBlank = useCallback((id: number, sentIdx: number, text: string) => {
    const next = new Map(hintMap)
    if (isSC) {
      pieces.forEach(p => {
        if (p.kind === 'word' && p.sentIdx === sentIdx && next.has(p.id)) {
          next.delete(p.id)
        }
      })
      if (!hintMap.has(id)) next.set(id, defaultHint(text))
    } else {
      if (next.has(id)) next.delete(id)
      else next.set(id, defaultHint(text))
    }
    setHintMap(next)
    const { content: c, answer: a } = buildOutput(pieces, next, subtype)
    onChange(c, a)
  }, [hintMap, isSC, pieces, subtype, onChange])

  const adjustHint = useCallback((id: number, text: string, delta: number) => {
    const current = hintMap.get(id) ?? defaultHint(text)
    const next = new Map(hintMap)
    const newVal = Math.max(1, Math.min(text.length - 1, current + delta))
    next.set(id, newVal)
    setHintMap(next)
    const { content: c, answer: a } = buildOutput(pieces, next, subtype)
    onChange(c, a)
  }, [hintMap, pieces, subtype, onChange])

  // ── INPUT MODE ──────────────────────────────────────────────────────────────
  if (mode === 'input') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500">
            {isSC ? '① 문장 입력 (한 줄 = 한 문장)' : '① 원문 붙여넣기'}
          </span>
        </div>
        <textarea
          value={rawText}
          onChange={e => handleRawChange(e.target.value)}
          placeholder={isSC
            ? 'The scientist ___ at the university every day.\nShe studies marine biology carefully.\n각 문장을 한 줄씩 입력하세요.'
            : 'Footage captured by submarines has shown us that strange creatures thrive in the deepest parts of the ocean. People tend to believe that such extreme environments are just barren zones.'}
          rows={isSC ? 8 : 6}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none leading-7"
        />
        <button
          type="button"
          onClick={enterSelectMode}
          disabled={!rawText.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded-xl text-sm font-bold transition"
        >
          <MousePointerClick size={14} /> ② 빈칸 단어 클릭으로 선택 →
        </button>
      </div>
    )
  }

  // ── SELECT MODE ──────────────────────────────────────────────────────────────
  const blankCount = hintMap.size
  const { answer: builtAnswer } = buildOutput(pieces, hintMap, subtype)
  const answerChips = builtAnswer ? builtAnswer.split(',').filter(Boolean) : []

  // SC: group pieces by line
  if (isSC) {
    const lines: Piece[][] = [[]]
    pieces.forEach(p => {
      if (p.kind === 'gap' && p.text.includes('\n')) {
        const parts = p.text.split('\n')
        parts.forEach((part, i) => {
          if (i > 0) lines.push([])
          if (part) lines[lines.length - 1].push({ kind: 'gap', text: part })
        })
      } else {
        lines[lines.length - 1].push(p)
      }
    })

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500">② 빈칸 단어 클릭 · 선택 후 − / + 로 힌트 글자 수 조절 (문장당 1개)</p>
          <button type="button" onClick={backToInput}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition">
            <RotateCcw size={11} /> 텍스트 수정
          </button>
        </div>

        <div className="border border-teal-100 rounded-xl overflow-hidden">
          {lines.filter(line => line.some(p => p.kind === 'word' || (p.kind === 'gap' && p.text.trim()))).map((line, li) => {
            const hasBlanked = line.some(p => p.kind === 'word' && hintMap.has(p.id))
            return (
              <div key={li} className={`flex items-baseline gap-2 px-4 py-2.5 border-b border-teal-50 last:border-0 ${hasBlanked ? 'bg-teal-50' : 'bg-white hover:bg-gray-50'}`}>
                <span className="text-xs font-bold text-gray-300 w-5 flex-shrink-0 text-right">{li + 1}.</span>
                <p className="text-sm text-gray-800 leading-7 flex flex-wrap gap-x-1">
                  {line.map((p, pi) => {
                    if (p.kind === 'gap') return <span key={`gap-${pi}`} className="whitespace-pre">{p.text}</span>
                    const isBlank = hintMap.has(p.id)
                    if (!isBlank) {
                      return (
                        <button
                          key={`word-${p.id}`}
                          type="button"
                          onClick={() => toggleBlank(p.id, p.sentIdx, p.text)}
                          className="rounded px-0.5 transition font-mono text-sm hover:bg-teal-100 hover:text-teal-800 text-gray-800"
                        >
                          {p.text}
                        </button>
                      )
                    }
                    const n = hintMap.get(p.id)!
                    const hintStr = p.text.slice(0, n) + '_'.repeat(Math.max(2, p.text.length - n))
                    return (
                      <span key={`word-${p.id}`} className="inline-flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); adjustHint(p.id, p.text, -1) }}
                          disabled={n <= 1}
                          className="w-4 h-4 flex items-center justify-center rounded bg-teal-200 text-teal-800 text-[10px] font-bold hover:bg-teal-300 disabled:opacity-30 leading-none"
                        >−</button>
                        <button
                          type="button"
                          onClick={() => toggleBlank(p.id, p.sentIdx, p.text)}
                          className="bg-teal-600 text-white font-bold ring-2 ring-teal-300 rounded px-0.5 font-mono text-xs"
                        >
                          {hintStr}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); adjustHint(p.id, p.text, +1) }}
                          disabled={n >= p.text.length - 1}
                          className="w-4 h-4 flex items-center justify-center rounded bg-teal-200 text-teal-800 text-[10px] font-bold hover:bg-teal-300 disabled:opacity-30 leading-none"
                        >+</button>
                      </span>
                    )
                  })}
                </p>
              </div>
            )
          })}
        </div>

        {answerChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="text-xs font-semibold text-gray-400 self-center">정답:</span>
            {answerChips.map((w, i) => (
              <span key={i} className="text-xs font-bold px-2 py-0.5 bg-teal-100 text-teal-800 rounded-full">{i + 1}. {w}</span>
            ))}
          </div>
        )}

        {blankCount === 0 && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            각 문장에서 빈칸으로 만들 단어를 클릭하세요.
          </p>
        )}
      </div>
    )
  }

  // ── CTW: flowing paragraph with per-blank hint adjuster ──────────────────────
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500">② 빈칸으로 만들 단어를 클릭하세요 · 선택 후 − / + 로 힌트 글자 수 조절</p>
        <button type="button" onClick={backToInput}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition">
          <RotateCcw size={11} /> 텍스트 수정
        </button>
      </div>

      <div className="border border-teal-100 rounded-xl bg-white p-4 leading-9 text-sm">
        {pieces.map((p, i) => {
          if (p.kind === 'gap') return <span key={`gap-${i}`} className="whitespace-pre-wrap">{p.text}</span>
          const isBlank = hintMap.has(p.id)
          if (!isBlank) {
            return (
              <button
                key={`word-${p.id}`}
                type="button"
                onClick={() => toggleBlank(p.id, p.sentIdx, p.text)}
                className="rounded px-0.5 transition font-mono hover:bg-teal-100 hover:text-teal-800 text-gray-800"
              >
                {p.text}
              </button>
            )
          }
          const n = hintMap.get(p.id)!
          const hintStr = p.text.slice(0, n) + '_'.repeat(Math.max(2, p.text.length - n))
          return (
            <span key={`word-${p.id}`} className="inline-flex items-center gap-0.5 mx-0.5">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); adjustHint(p.id, p.text, -1) }}
                disabled={n <= 1}
                className="w-4 h-4 flex items-center justify-center rounded bg-teal-200 text-teal-800 text-[10px] font-bold hover:bg-teal-300 disabled:opacity-30 leading-none"
              >−</button>
              <button
                type="button"
                onClick={() => toggleBlank(p.id, p.sentIdx, p.text)}
                className="bg-teal-600 text-white font-bold ring-2 ring-teal-300 rounded px-0.5 font-mono text-xs"
              >
                {hintStr}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); adjustHint(p.id, p.text, +1) }}
                disabled={n >= p.text.length - 1}
                className="w-4 h-4 flex items-center justify-center rounded bg-teal-200 text-teal-800 text-[10px] font-bold hover:bg-teal-300 disabled:opacity-30 leading-none"
              >+</button>
            </span>
          )
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{blankCount}개 선택됨</span>
        {blankCount > 0 && (
          <button type="button"
            onClick={() => { setHintMap(new Map()); onChange('', '') }}
            className="text-gray-400 hover:text-red-500 transition flex items-center gap-1">
            <RotateCcw size={10} /> 선택 초기화
          </button>
        )}
      </div>

      {answerChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 bg-teal-50 rounded-xl px-3 py-2">
          <span className="text-xs font-semibold text-gray-400 self-center">정답 순서:</span>
          {answerChips.map((w, i) => (
            <span key={i} className="text-xs font-bold px-2 py-0.5 bg-teal-100 text-teal-800 rounded-full">{i + 1}. {w}</span>
          ))}
        </div>
      )}
    </div>
  )
}
