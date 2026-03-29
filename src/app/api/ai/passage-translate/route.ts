import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getUserFromCookie } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const user = await getUserFromCookie()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { text, topic } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key missing' }, { status: 500 })

  const client = new Anthropic({ apiKey })

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `You are a TOEFL reading instructor for Korean students. For the following English academic paragraph, provide THREE things:

1. Korean translation: translate each sentence into Korean on its own line (직독직해 style, no parenthetical notes, academic register)
2. A reading comprehension commentary in Korean (독해 해설 — explain key vocabulary in context, important grammar structures, main ideas, and how this paragraph fits the passage; write in flowing Korean prose, 3-5 sentences)
3. Key vocabulary (주요 어휘): identify 4-6 academically important words or phrases from this paragraph. For each provide the exact English word/phrase, concise Korean meaning (1-5 words), and one Korean sentence explaining how it is used in context.

Topic: ${topic ?? 'general academic'}

Paragraph:
${text.trim()}

IMPORTANT: Return ONLY raw JSON with no markdown, no backticks, no code fences. Exactly this format:
{"text_ko":"sentence1\\nsentence2","explanation":"Korean commentary here","vocab":[{"word":"cognitive bias","meaning_ko":"인지 편향","context":"인간의 판단을 왜곡시키는 심리적 경향을 나타낸다"}]}`,
    }],
  })

  const raw = (msg.content[0] as { type: string; text: string }).text?.trim() ?? ''
  // Strip any markdown code fences the model may have added
  const jsonStr = raw
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim()

  let text_ko = ''
  let explanation = ''
  let vocab: { word: string; meaning_ko: string; context: string }[] = []
  try {
    const parsed = JSON.parse(jsonStr)
    text_ko = (parsed.text_ko ?? '').replace(/\\n/g, '\n').replace(/\n\n+/g, '\n')
    explanation = parsed.explanation ?? ''
    vocab = Array.isArray(parsed.vocab) ? parsed.vocab : []
  } catch {
    // fallback: whole response is the translation
    text_ko = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
  }
  return NextResponse.json({ text_ko, explanation, vocab })
}
