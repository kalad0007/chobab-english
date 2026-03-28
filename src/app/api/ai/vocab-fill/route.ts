import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getUserFromCookie } from '@/lib/supabase/server'

const TOPIC_OPTIONS = [
  'biology','chemistry','physics','astronomy','geology','ecology',
  'history_us','history_world','anthropology','psychology','sociology',
  'economics','art_music','literature','architecture','environmental',
  'linguistics','general',
]

export async function POST(req: NextRequest) {
  const user = await getUserFromCookie()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { word } = await req.json()
  if (!word?.trim()) return NextResponse.json({ error: 'word required' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 })

  const client = new Anthropic({ apiKey })

  const prompt = `You are a TOEFL vocabulary expert. Generate a complete vocab card for the English word: "${word.trim()}"

Return ONLY valid JSON (no markdown, no code blocks):
{
  "part_of_speech": "adjective",
  "definition_ko": "없어서는 안 될, 필수적인",
  "definition_en": "absolutely necessary; impossible to be without",
  "synonyms": ["essential","crucial","vital","necessary","imperative"],
  "antonyms": ["dispensable","unnecessary","optional"],
  "topic_category": "general",
  "example_sentence": "Clean water is *indispensable* / for the survival / of all living organisms.",
  "example_sentence_ko": "깨끗한 물은 *없어서는 안 된다* / 생존을 위해 / 모든 살아있는 생명체에게."
}

Rules:
- part_of_speech: noun | verb | adjective | adverb | preposition | conjunction | phrase
- definition_ko: concise Korean translation (up to 20 chars)
- definition_en: one clear English definition
- synonyms: exactly 3-5 TOEFL-level synonyms commonly used in academic paraphrasing
- antonyms: 1-3 antonyms (empty array [] if none natural)
- topic_category: pick ONE from: ${TOPIC_OPTIONS.join(', ')}
- example_sentence: 15-25 word academic-register sentence. Mark the target word with *asterisks*. Add chunk breaks " / " (space-slash-space) at natural phrase boundaries (subject / predicate / modifier groups).
- example_sentence_ko: Korean direct translation matching the EXACT same chunk breaks " / " as example_sentence. Wrap the Korean equivalent of the target word with *asterisks*.`

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = (msg.content[0] as { type: string; text: string }).text?.trim()
  try {
    const parsed = JSON.parse(raw)
    return NextResponse.json(parsed)
  } catch {
    // Try to extract JSON from response
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return NextResponse.json(JSON.parse(match[0]))
      } catch { /* fall through */ }
    }
    return NextResponse.json({ error: 'AI 응답 파싱 실패', raw }, { status: 500 })
  }
}
