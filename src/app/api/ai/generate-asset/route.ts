import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getUserFromCookie } from '@/lib/supabase/server'
import { readFileSync } from 'fs'
import { join } from 'path'

function getAnthropicKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY
  try {
    const raw = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
    const m = raw.match(/^ANTHROPIC_API_KEY=(.+)$/m)
    if (m) return m[1].trim()
  } catch { /* ignore */ }
  return ''
}

const VOICE_YW = 'en-US-Neural2-F'
const VOICE_YM = 'en-US-Neural2-D'

async function synthesize(text: string, voice: string, apiKey: string): Promise<Buffer | null> {
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: 'en-US', name: voice },
      audioConfig: { audioEncoding: 'MP3', speakingRate: 0.9, pitch: 0 },
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.audioContent ? Buffer.from(data.audioContent, 'base64') : null
}

export async function POST(req: NextRequest) {
  const user = await getUserFromCookie()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { keywords, subtype, difficulty = 3.0 } = await req.json()
  if (!keywords?.trim()) return NextResponse.json({ error: 'keywords required' }, { status: 400 })

  const anthropicKey = getAnthropicKey()
  if (!anthropicKey) return NextResponse.json({ error: 'AI API key not configured' }, { status: 500 })

  const ai = new Anthropic({ apiKey: anthropicKey })
  const isDialogue = ['conversation', 'choose_response'].includes(subtype)

  // ── 1. Generate script ───────────────────────────────────
  const scriptPrompt = isDialogue
    ? `Create a short TOEFL Listening dialogue about: "${keywords}".
Format each line as "A: ..." or "B: ..." (two speakers, ~80 words total). Band ${difficulty} level.
Return JSON only: {"title":"...", "script":"A: ...\\nB: ...\\n..."}`
    : `Create a short TOEFL Listening ${subtype === 'campus_announcement' ? 'campus announcement' : 'academic monologue'} about: "${keywords}".
Single speaker, ~120 words. Band ${difficulty} level.
Return JSON only: {"title":"...", "script":"..."}`

  const scriptMsg = await ai.messages.create({
    model: 'claude-opus-4-5', max_tokens: 700,
    messages: [{ role: 'user', content: scriptPrompt }],
  })
  const rawScript = scriptMsg.content[0].type === 'text' ? scriptMsg.content[0].text : ''

  let script = '', title = keywords
  try {
    const parsed = JSON.parse(rawScript.replace(/```json\n?|\n?```/g, '').trim())
    script = parsed.script ?? ''
    title = parsed.title ?? keywords
  } catch { /* skip */ }

  if (!script) return NextResponse.json({ error: '스크립트 생성에 실패했습니다.' }, { status: 500 })

  // ── 2. TTS → Storage ─────────────────────────────────────
  const ttsKey = process.env.GOOGLE_TTS_API_KEY
  let audioUrl: string | null = null

  if (ttsKey) {
    let audioBuffer: Buffer = Buffer.alloc(0)

    if (isDialogue) {
      const lines = script.split('\n').filter(l => l.trim())
      const buffers: Buffer[] = []
      for (const line of lines) {
        const trimmed = line.trim()
        const isA = /^A:/i.test(trimmed)
        const isB = /^B:/i.test(trimmed)
        if (isA || isB) {
          const text = trimmed.replace(/^[AB]:\s*/i, '').trim()
          if (text) {
            const buf = await synthesize(text, isA ? VOICE_YW : VOICE_YM, ttsKey)
            if (buf) buffers.push(buf)
          }
        }
      }
      if (buffers.length > 0) audioBuffer = Buffer.concat(buffers)
    } else {
      const buf = await synthesize(script, VOICE_YW, ttsKey)
      if (buf) audioBuffer = buf
    }

    if (audioBuffer.length > 0) {
      const admin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const fileName = `assets/${user.id}_${Date.now()}.mp3`
      const { error: uploadErr } = await admin.storage
        .from('question-audio').upload(fileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true })
      if (!uploadErr) {
        const { data: urlData } = admin.storage.from('question-audio').getPublicUrl(fileName)
        audioUrl = urlData.publicUrl
      }
    }
  }

  // ── 3. Generate 2 questions ───────────────────────────────
  const qPrompt = `Based on this TOEFL Listening script (${subtype}):
---
${script}
---
Generate 2 multiple-choice questions (4 options each). Return JSON array only:
[{"content":"...","options":[{"num":1,"text":"..."},{"num":2,"text":"..."},{"num":3,"text":"..."},{"num":4,"text":"..."}],"answer":"1","explanation":"..."}]`

  const qMsg = await ai.messages.create({
    model: 'claude-opus-4-5', max_tokens: 900,
    messages: [{ role: 'user', content: qPrompt }],
  })
  const rawQ = qMsg.content[0].type === 'text' ? qMsg.content[0].text : '[]'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let questions: any[] = []
  try {
    questions = JSON.parse(rawQ.replace(/```json\n?|\n?```/g, '').trim())
  } catch { /* empty */ }

  // ── 4. Save asset to DB ───────────────────────────────────
  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const tags = [subtype, `band_${difficulty}`, ...keywords.split(/[\s,]+/).filter(Boolean).slice(0, 3)]
  const { data: asset } = await admin.from('learning_assets').insert({
    teacher_id: user.id, asset_type: 'audio', title,
    tags, file_url: audioUrl, transcript: script,
    metadata: { subtype, difficulty, auto_generated: true },
  }).select('id').single()

  return NextResponse.json({
    ok: true,
    assetId: asset?.id,
    title, script, audioUrl,
    questions: questions.map(q => ({
      ...q, category: 'listening', question_subtype: subtype,
      difficulty, audio_script: script, audio_url: audioUrl,
    })),
  })
}
