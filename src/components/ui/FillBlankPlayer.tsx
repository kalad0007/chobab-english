'use client'

interface Token { id: string; type: string; text: string; isBlank: boolean; showLetters: number }

interface Props {
  tokens: Token[]
  subtype: string | null
  value: string
  onChange: (v: string) => void
}

function groupSentences(tokens: Token[]): Token[][] {
  const groups: Token[][] = []
  let cur: Token[] = []
  tokens.forEach(t => {
    cur.push(t)
    if (t.type === 'nonword' && t.text.includes('\n')) { groups.push(cur); cur = [] }
  })
  if (cur.length) groups.push(cur)
  return groups.filter(g => g.some(t => t.type === 'word'))
}

export default function FillBlankPlayer({ tokens, subtype, value, onChange }: Props) {
  const blankIds = tokens.filter(t => t.isBlank).map(t => t.id)
  const blankIndexMap = new Map(blankIds.map((id, i) => [id, i]))
  const answers = value ? value.split(',').map(a => a.trim()) : []

  function handleChange(idx: number, val: string) {
    const next = Array.from({ length: Math.max(blankIds.length, idx + 1) }, (_, i) => answers[i] ?? '')
    next[idx] = val
    onChange(next.join(', '))
  }

  function renderToken(t: Token) {
    const display = t.text.replace(/\n/g, '')
    if (!t.isBlank) return display ? <span key={t.id}>{display}</span> : null

    const idx = blankIndexMap.get(t.id) ?? 0
    const w = t.text.replace(/[^a-zA-Z]/g, '')
    const shown = w.slice(0, t.showLetters)
    const blankLen = Math.max(3, w.length - t.showLetters)

    // 저장값은 full word (shown+typed). 입력창엔 shown 이후 부분만 표시
    const stored = answers[idx] ?? ''
    const inputVal = stored.toLowerCase().startsWith(shown.toLowerCase())
      ? stored.slice(shown.length)
      : stored

    return (
      <span key={t.id} className="inline-flex items-baseline mx-0.5">
        {shown && <span className="text-blue-600 font-semibold text-sm">{shown}</span>}
        <input
          value={inputVal}
          onChange={e => handleChange(idx, shown + e.target.value)}
          style={{ width: `${blankLen * 0.65 + 0.9}rem` }}
          className="border-b-2 border-blue-400 focus:border-blue-600 bg-blue-50 focus:bg-blue-100 text-center text-sm font-bold text-blue-700 focus:outline-none transition rounded-sm px-0.5"
          placeholder={'_'.repeat(blankLen)}
        />
      </span>
    )
  }

  if (subtype === 'sentence_completion') {
    return (
      <div className="space-y-2">
        {groupSentences(tokens).map((sent, si) => (
          <div key={si} className="flex items-baseline gap-2">
            <span className="text-xs font-bold text-gray-400 w-5 flex-shrink-0 text-right">{si + 1}.</span>
            <div className="text-sm text-gray-800 leading-9">{sent.map(t => renderToken(t))}</div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="text-sm text-gray-800 leading-9">
      {tokens.map(t => renderToken(t))}
    </div>
  )
}
