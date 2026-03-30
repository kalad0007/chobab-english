import { Mail } from 'lucide-react'

interface ParsedEmail {
  meta: { from?: string; to?: string; date?: string; subject?: string }
  paragraphs: string[]
}

function parseEmailText(text: string): ParsedEmail {
  const lines = text.split('\n')
  const meta: ParsedEmail['meta'] = {}
  let bodyStartIdx = 0
  let foundAnyHeader = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lower = line.toLowerCase()
    if (lower.startsWith('from:')) {
      meta.from = line.slice(line.indexOf(':') + 1).trim()
      foundAnyHeader = true
    } else if (lower.startsWith('to:')) {
      meta.to = line.slice(line.indexOf(':') + 1).trim()
      foundAnyHeader = true
    } else if (lower.startsWith('date:')) {
      meta.date = line.slice(line.indexOf(':') + 1).trim()
      foundAnyHeader = true
    } else if (lower.startsWith('subject:')) {
      meta.subject = line.slice(line.indexOf(':') + 1).trim()
      foundAnyHeader = true
    } else if (line.trim() === '' && foundAnyHeader) {
      bodyStartIdx = i + 1
      break
    } else if (!foundAnyHeader) {
      bodyStartIdx = i
      break
    }
  }

  const bodyText = lines.slice(bodyStartIdx).join('\n').trim()
  const paragraphs = bodyText.split(/\n\n+/).filter(p => p.trim())
  return { meta, paragraphs }
}

const SIGNOFF_RE = /^(best regards|sincerely|yours sincerely|thank you|regards|kind regards|warm regards|respectfully|yours truly|cheers)/i

export default function EmailPassageRenderer({ text }: { text: string }) {
  const { meta, paragraphs } = parseEmailText(text)

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Subject */}
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-1.5 text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1.5">
          <Mail size={12} />
          SUBJECT
        </div>
        <p className="text-sm font-bold text-gray-900">{meta.subject ?? '(No Subject)'}</p>
        {(meta.from || meta.date) && (
          <p className="text-xs text-gray-400 mt-1">
            {meta.from && <span className="mr-3">From: {meta.from}</span>}
            {meta.date && <span>{meta.date}</span>}
          </p>
        )}
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-3">
        {paragraphs.map((para, i) => {
          const trimmed = para.trim()
          const isDear = /^dear[\s,]/i.test(trimmed)
          const isSignoff = SIGNOFF_RE.test(trimmed)

          if (isDear) {
            return <p key={i} className="text-sm font-bold text-gray-900">{trimmed}</p>
          }
          if (isSignoff) {
            return <p key={i} className="text-sm italic text-gray-500 whitespace-pre-wrap">{trimmed}</p>
          }
          return <p key={i} className="text-sm text-gray-800 leading-7">{trimmed}</p>
        })}
      </div>
    </div>
  )
}
