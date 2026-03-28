import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getUserFromCookie } from '@/lib/supabase/server'

const TOPIC_EN: Record<string, string> = {
  biology: 'Biology', chemistry: 'Chemistry', physics: 'Physics',
  astronomy: 'Astronomy', geology: 'Geology', ecology: 'Ecology',
  history_us: 'American History', history_world: 'World History',
  anthropology: 'Anthropology', psychology: 'Psychology',
  sociology: 'Sociology', economics: 'Economics',
  art_music: 'Art & Music', literature: 'Literature',
  architecture: 'Architecture', environmental: 'Environmental Science',
  linguistics: 'Linguistics', general: 'General Academic',
}

function bandToCefr(d: number) {
  if (d >= 5.0) return 'C1-C2 (TOEFL 100-120)'
  if (d >= 4.0) return 'B2 (TOEFL 80-100)'
  if (d >= 3.0) return 'B1-B2 (TOEFL 60-80)'
  return 'A2-B1 (TOEFL 45-60)'
}

export async function POST(req: NextRequest) {
  const user = await getUserFromCookie()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { topic, count = 20, difficulty = 3.0, excludeWords = [] } = await req.json()
  if (!topic) return NextResponse.json({ error: 'topic required' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 })

  const client = new Anthropic({ apiKey })
  const topicEn = TOPIC_EN[topic] ?? topic
  const cefr    = bandToCefr(difficulty)

  const excludeClause = excludeWords.length > 0
    ? `\n\nDo NOT include any of these already-existing words: ${excludeWords.join(', ')}`
    : ''

  const prompt = `You are a TOEFL vocabulary expert. Generate exactly ${count} important TOEFL vocabulary words for the academic topic: "${topicEn}"

Difficulty level: Band ${difficulty} (${cefr})

Return ONLY a JSON array of words — no definitions, no explanations, just the words:
["word1", "word2", "word3", ...]

Requirements:
- Academic register words that commonly appear in TOEFL reading/listening passages about ${topicEn}
- Appropriate difficulty for ${cefr}
- No proper nouns
- Mix of adjectives, verbs, and nouns
- Words that are frequently paraphrased in TOEFL answer choices
- No extremely common words (like "big", "fast", "new")
- Exactly ${count} unique words${excludeClause}`

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',  // Fast model for simple list generation
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = (msg.content[0] as { type: string; text: string }).text?.trim()

  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) throw new Error('not array')
    return NextResponse.json({ words: arr.slice(0, count) })
  } catch {
    const match = raw.match(/\[[\s\S]*\]/)
    if (match) {
      try {
        const arr = JSON.parse(match[0])
        return NextResponse.json({ words: arr.slice(0, count) })
      } catch { /* fall through */ }
    }
    return NextResponse.json({ error: 'AI 응답 파싱 실패', raw }, { status: 500 })
  }
}
