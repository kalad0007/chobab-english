import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getUserFromCookie } from '@/lib/supabase/server'

// 단일화자 4가지 음성
const VOICE_YW = 'en-US-Neural2-F'  // Young Woman  (밝고 젊은 여성)
const VOICE_YM = 'en-US-Neural2-D'  // Young Man    (젊고 권위있는 남성)
const VOICE_OW = 'en-US-Neural2-E'  // Older Woman  (안정적·중성적 여성)
const VOICE_OM = 'en-US-Neural2-J'  // Older Man    (차분하고 깊은 남성)

// 대화형 자동 배정: A: → 여성(YW), B: → 남성(YM)
const VOICE_FEMALE = VOICE_YW
const VOICE_MALE   = VOICE_YM

const VOICE_MAP: Record<string, string> = {
  yw: VOICE_YW,
  ym: VOICE_YM,
  ow: VOICE_OW,
  om: VOICE_OM,
  // 하위 호환
  female: VOICE_YW,
  male:   VOICE_YM,
}

async function synthesize(text: string, voiceName: string, apiKey: string): Promise<Buffer | null> {
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: 'en-US', name: voiceName },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 0.9, pitch: 0 },
      }),
    }
  )
  if (!res.ok) {
    console.error('Google TTS error:', await res.text())
    return null
  }
  const data = await res.json()
  return data.audioContent ? Buffer.from(data.audioContent, 'base64') : null
}

// Google Cloud Text-to-Speech Neural2 → Supabase Storage
export async function POST(req: NextRequest) {
  try {
  const user = await getUserFromCookie()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { script, questionId, gender = 'female', subtype } = await req.json()
  if (!script) return NextResponse.json({ error: 'script required' }, { status: 400 })

  const apiKey = process.env.GOOGLE_TTS_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Google TTS API key not configured' }, { status: 500 })

  let audioBuffer: Buffer

  if (subtype === 'conversation') {
    // 대화형: A: → 여성, B: → 남성으로 각 라인별 합성 후 연결
    const lines = script.split('\n').filter((l: string) => l.trim())
    const segments: { voice: string; text: string }[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (/^A:/i.test(trimmed)) {
        segments.push({ voice: VOICE_FEMALE, text: trimmed.replace(/^A:\s*/i, '') })
      } else if (/^B:/i.test(trimmed)) {
        segments.push({ voice: VOICE_MALE, text: trimmed.replace(/^B:\s*/i, '') })
      } else if (trimmed) {
        // 라벨 없는 줄: 이전 화자와 반대 목소리 또는 여성으로 fallback
        const last = segments[segments.length - 1]
        const voice = last ? (last.voice === VOICE_FEMALE ? VOICE_MALE : VOICE_FEMALE) : VOICE_FEMALE
        segments.push({ voice, text: trimmed })
      }
    }

    // 연속된 같은 목소리 묶기 (API 호출 최소화)
    const merged: { voice: string; text: string }[] = []
    for (const seg of segments) {
      if (merged.length > 0 && merged[merged.length - 1].voice === seg.voice) {
        merged[merged.length - 1].text += ' ' + seg.text
      } else {
        merged.push({ ...seg })
      }
    }

    if (merged.length === 0) {
      return NextResponse.json({ error: '스크립트를 파싱할 수 없습니다. A:/B: 형식으로 작성하세요.' }, { status: 400 })
    }

    const buffers: Buffer[] = []
    for (const seg of merged) {
      const buf = await synthesize(seg.text, seg.voice, apiKey)
      if (buf) buffers.push(buf)
    }

    if (buffers.length === 0) {
      return NextResponse.json({ error: 'TTS 생성에 실패했습니다.' }, { status: 500 })
    }
    audioBuffer = Buffer.concat(buffers)

  } else {
    // 단일 화자: gender 파라미터로 목소리 선택 (yw/ym/ow/om 또는 female/male)
    const voice = VOICE_MAP[gender?.toLowerCase?.()] ?? VOICE_YW
    const buf = await synthesize(script, voice, apiKey)
    if (!buf) {
      return NextResponse.json({ error: 'TTS 생성에 실패했습니다.' }, { status: 500 })
    }
    audioBuffer = buf
  }

  // base64 → Buffer → Supabase Storage 업로드
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // questionId 기반 고정 파일명 → 재생성 시 기존 파일 자동 덮어쓰기 (upsert:true)
  const fileName = `listening/${user.id}_${questionId ?? Date.now()}.mp3`

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

  // 재생성 시 브라우저 캐시 무효화를 위해 타임스탬프 쿼리 추가
  const audioUrl = `${publicUrl}?t=${Date.now()}`

  return NextResponse.json({ audioUrl })
  } catch (err) {
    console.error('TTS route error:', err)
    return NextResponse.json({ error: 'TTS 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
