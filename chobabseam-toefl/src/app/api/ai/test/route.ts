import { NextResponse } from 'next/server'

export async function GET() {
  const geminiKey = process.env.GEMINI_API_KEY
  const ttsKey = process.env.GOOGLE_TTS_API_KEY

  const results: Record<string, unknown> = {
    GEMINI_API_KEY_set: !!geminiKey,
    GOOGLE_TTS_API_KEY_set: !!ttsKey,
    GEMINI_API_KEY_prefix: geminiKey?.slice(0, 12) ?? 'not set',
    GOOGLE_TTS_KEY_prefix: ttsKey?.slice(0, 12) ?? 'not set',
  }

  // GEMINI_API_KEY로 모델 목록 조회
  if (geminiKey) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}&pageSize=5`
    )
    const data = await res.json()
    results.geminiKey_models = data?.models?.map((m: { name: string }) => m.name) ?? data
  }

  return NextResponse.json(results)
}
