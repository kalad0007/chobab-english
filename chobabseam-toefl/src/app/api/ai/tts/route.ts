import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getUserFromCookie } from '@/lib/supabase/server'

// Google Cloud Text-to-Speech Neural2 → Supabase Storage
export async function POST(req: NextRequest) {
  const user = await getUserFromCookie()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { script, questionId } = await req.json()
  if (!script) return NextResponse.json({ error: 'script required' }, { status: 400 })

  const apiKey = process.env.GOOGLE_TTS_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Google TTS API key not configured' }, { status: 500 })

  // Google Cloud TTS Neural2 호출 (en-US-Neural2-F: 자연스러운 여성 영어 목소리)
  const ttsRes = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: script },
        voice: {
          languageCode: 'en-US',
          name: 'en-US-Neural2-F',   // 자연스러운 여성 목소리
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 0.9,         // 약간 천천히 (리스닝 연습)
          pitch: 0,
        },
      }),
    }
  )

  if (!ttsRes.ok) {
    const errText = await ttsRes.text()
    console.error('Google TTS error:', errText)
    return NextResponse.json({ error: 'TTS generation failed', detail: errText }, { status: 500 })
  }

  const ttsData = await ttsRes.json()
  const audioBase64: string = ttsData.audioContent

  if (!audioBase64) {
    return NextResponse.json({ error: 'No audio content in response' }, { status: 500 })
  }

  // base64 → Buffer → Supabase Storage 업로드
  const audioBuffer = Buffer.from(audioBase64, 'base64')

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const fileName = `listening/${user.id}_${questionId ?? Date.now()}_${Date.now()}.mp3`

  const { error: uploadError } = await supabase.storage
    .from('question-audio')
    .upload(fileName, audioBuffer, {
      contentType: 'audio/mpeg',
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
