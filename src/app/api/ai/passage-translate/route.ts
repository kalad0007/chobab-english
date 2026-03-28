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
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are a TOEFL reading instructor. Translate this English academic paragraph into Korean using direct reading style (직독직해).

Rules:
- Translate sentence by sentence, keeping academic register
- Each sentence on its own line, matching the original sentence order
- Do NOT add explanations or parenthetical notes
- Topic context: ${topic ?? 'general academic'}

Paragraph:
${text.trim()}

Return ONLY the Korean translation, nothing else.`,
    }],
  })

  const text_ko = (msg.content[0] as { type: string; text: string }).text?.trim()
  return NextResponse.json({ text_ko })
}
