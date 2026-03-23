import { NextRequest, NextResponse } from 'next/server'
import { createClient, getUserFromCookie } from '@/lib/supabase/server'

// Gemini TTS API - audio_script → audio file → Supabase Storage
export async function POST(req: NextRequest) {
  const user = await getUserFromCookie()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { script, questionId } = await req.json()
  if (!script) return NextResponse.json({ error: 'script required' }, { status: 400 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })

  // Gemini 2.0 Flash TTS 호출
  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-tts:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: script }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      }),
    }
  )

  if (!geminiRes.ok) {
    const errText = await geminiRes.text()
    console.error('Gemini TTS error:', errText)
    return NextResponse.json({ error: 'TTS generation failed', detail: errText }, { status: 500 })
  }

  const geminiData = await geminiRes.json()
  const audioBase64: string | undefined =
    geminiData?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data

  if (!audioBase64) {
    return NextResponse.json({ error: 'No audio data in response' }, { status: 500 })
  }

  // base64 → Buffer
  const audioBuffer = Buffer.from(audioBase64, 'base64')

  // Supabase Storage에 업로드
  const supabase = await createClient()
  const fileName = `listening/${questionId ?? Date.now()}_${Date.now()}.wav`

  const { error: uploadError } = await supabase.storage
    .from('question-audio')
    .upload(fileName, audioBuffer, {
      contentType: 'audio/wav',
      upsert: true,
    })

  if (uploadError) {
    console.error('Storage upload error:', uploadError)
    return NextResponse.json({ error: 'Storage upload failed', detail: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage
    .from('question-audio')
    .getPublicUrl(fileName)

  return NextResponse.json({ audioUrl: publicUrl })
}
