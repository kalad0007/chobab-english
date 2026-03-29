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
      content: `You are a TOEFL reading instructor for Korean students. For the following English academic paragraph, provide TWO things:

1. A Korean translation (직독직해 style — translate sentence by sentence, one sentence per line, keep academic register, no parenthetical notes)
2. A reading comprehension commentary in Korean (독해 해설 — explain key vocabulary in context, important grammar structures, main ideas, and how this paragraph fits the passage; write in flowing Korean prose, 3-5 sentences)

Topic context: ${topic ?? 'general academic'}

Paragraph:
${text.trim()}

Return ONLY a JSON object in this exact format (no markdown, no code fences):
{"text_ko":"Korean translation here, one sentence per line","explanation":"독해 해설 Korean commentary here"}`,
    }],
  })

  const raw = (msg.content[0] as { type: string; text: string }).text?.trim() ?? ''
  let text_ko = ''
  let explanation = ''
  try {
    const parsed = JSON.parse(raw)
    text_ko = (parsed.text_ko ?? '').replace(/\n\n+/g, '\n')
    explanation = parsed.explanation ?? ''
  } catch {
    // fallback: treat as plain translation
    text_ko = raw.replace(/\n\n+/g, '\n')
  }
  return NextResponse.json({ text_ko, explanation })
}
