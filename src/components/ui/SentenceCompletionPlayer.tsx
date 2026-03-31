'use client'

import { useState } from 'react'

interface Part {
  type: 'text'
  text: string
}
interface Blank {
  type: 'blank'
  hint: string
  blankLen: number
  index: number
}

function parseContent(content: string): Array<Part | Blank> {
  const result: Array<Part | Blank> = []
  let blankIndex = 0
  const lines = content.split('\n')

  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) result.push({ type: 'text', text: '\n' })
    const regex = /([a-zA-Z]+)(_{2,})/g
    let lastIndex = 0
    let match
    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: 'text', text: line.slice(lastIndex, match.index) })
      }
      result.push({ type: 'blank', hint: match[1], blankLen: match[2].length, index: blankIndex++ })
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < line.length) {
      result.push({ type: 'text', text: line.slice(lastIndex) })
    }
  })

  return result
}

interface Props {
  content: string
  value: string
  onChange: (v: string) => void
  showResult?: boolean
  correctAnswer?: string
}

export default function SentenceCompletionPlayer({ content, value, onChange, showResult, correctAnswer }: Props) {
  const parts = parseContent(content)
  const blanks = parts.filter((p): p is Blank => p.type === 'blank')

  const [inputs, setInputs] = useState<string[]>(() => {
    if (!value) return Array(blanks.length).fill('')
    const words = value.split(',').map(w => w.trim())
    return blanks.map((blank, i) => {
      const word = words[i] ?? ''
      const lower = word.toLowerCase()
      const hintLower = blank.hint.toLowerCase()
      return lower.startsWith(hintLower) ? word.slice(blank.hint.length) : word
    })
  })

  function handleInput(idx: number, val: string) {
    const newInputs = [...inputs]
    newInputs[idx] = val
    setInputs(newInputs)
    const combined = newInputs.map((v, i) => blanks[i].hint + v).join(',')
    onChange(combined)
  }

  const correctWords = correctAnswer ? correctAnswer.split(',').map(w => w.trim()) : []

  if (blanks.length === 0) {
    return (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={4}
        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
    )
  }

  return (
    <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-xl p-4 text-sm text-gray-800 leading-10">
      {parts.map((part, i) => {
        if (part.type === 'text') {
          if (part.text === '\n') return <br key={i} />
          return <span key={i}>{part.text}</span>
        }
        const blank = part as Blank
        const inputVal = inputs[blank.index] ?? ''
        const inputWidth = Math.max(blank.blankLen * 11, 44)

        let borderColor = 'border-blue-400'
        if (showResult) {
          const fullWord = (blank.hint + inputVal).toLowerCase()
          const correct = (correctWords[blank.index] ?? '').toLowerCase()
          borderColor = fullWord === correct ? 'border-green-500' : 'border-red-400'
        }

        return (
          <span key={i} className="inline-flex items-baseline">
            <span className="text-blue-600 font-semibold">{blank.hint}</span>
            <input
              type="text"
              value={inputVal}
              onChange={e => handleInput(blank.index, e.target.value)}
              disabled={showResult}
              style={{ width: `${inputWidth}px`, verticalAlign: 'baseline', lineHeight: '1', padding: '0 2px', height: '1.2em' }}
              className={`border-b-2 ${borderColor} bg-transparent outline-none text-gray-900 font-semibold focus:border-blue-700 disabled:opacity-80`}
            />
          </span>
        )
      })}
    </div>
  )
}
