import { NextRequest, NextResponse } from 'next/server'
import { getUserFromCookie } from '@/lib/supabase/server'
import { deductCredits, refundCredits, getCreditCostFromDB } from '@/lib/plan-guard'

export const maxDuration = 60 // Vercel Pro: 60초 타임아웃

export async function POST(req: NextRequest) {
  const user = await getUserFromCookie()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { audioUrl, prompt } = await req.json()
  if (!audioUrl) return NextResponse.json({ error: 'audioUrl required' }, { status: 400 })

  // AI Studio 키 우선 (Files API 지원), 없으면 Google Cloud 키
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_TTS_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 })

  const cost = await getCreditCostFromDB('speaking_eval', 1)
  const { allowed, remaining } = await deductCredits(user.id, cost, '스피킹 평가')
  if (!allowed) {
    return NextResponse.json({ error: '크레딧이 부족합니다', remaining }, { status: 403 })
  }

  try {
  // 1단계: 오디오 파일 fetch
  const audioRes = await fetch(audioUrl)
  if (!audioRes.ok) {
    return NextResponse.json({ error: `Failed to fetch audio: ${audioRes.status}` }, { status: 500 })
  }
  const audioBuffer = Buffer.from(await audioRes.arrayBuffer())
  const mimeType = audioUrl.endsWith('.mp4') ? 'audio/mp4' : 'audio/webm'
  const base64Audio = audioBuffer.toString('base64')

  // 2단계: 평가 프롬프트
  const evalPrompt = `You are an English speaking evaluator for Korean middle/high school students.
Task: ${prompt ?? 'General English speaking'}

Evaluate the spoken English on:
1. Pronunciation & Fluency: 0-25
2. Grammar & Vocabulary: 0-25
3. Content & Relevance: 0-25
4. Confidence & Expression: 0-25

Reply in JSON only (no markdown):
{"totalScore":0,"pronunciation":0,"grammar":0,"content":0,"confidence":0,"feedback":"한국어 피드백","strengths":"한국어 장점","improvements":"한국어 개선점"}`

  // 3단계: Gemini API 호출 (인라인 base64, Files API 불필요)
  const evalRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Audio,
              },
            },
            { text: evalPrompt },
          ],
        }],
      }),
    }
  )

  if (!evalRes.ok) {
    const errText = await evalRes.text()
    console.error('Gemini eval error:', errText)
    const debugInfo = `[키: ${apiKey.slice(0, 10)}... GEMINI_KEY=${!!process.env.GEMINI_API_KEY} TTS_KEY=${!!process.env.GOOGLE_TTS_API_KEY}]`
    return NextResponse.json({ error: 'Evaluation failed', detail: `${errText}\n${debugInfo}` }, { status: 500 })
  }

  const evalData = await evalRes.json()
  const text: string = evalData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  if (!text) {
    return NextResponse.json({ error: 'Empty response from Gemini', raw: evalData }, { status: 500 })
  }

  try {
    const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const result = JSON.parse(clean)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'JSON parse failed', raw: text }, { status: 500 })
  }
  } catch (err) {
    await refundCredits(user.id, cost)
    throw err
  }
}
