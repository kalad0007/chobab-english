import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CATEGORY_LABELS, QUESTION_SUBTYPE_LABELS, getDiffInfo, usesAlphaOptions, optionLabel } from '@/lib/utils'
import { ArrowLeft, Pencil, Volume2 } from 'lucide-react'
import type { Question } from '@/types/database'
import DeleteButton from '../../DeleteButton'
import SetDeleteButton from './SetDeleteButton'
import AIAddButton from './AIAddButton'
import VocabWords from '@/components/ui/VocabWords'
import SetOrderButtons from './SetOrderButtons'
import TtsAutoButton from './TtsAutoButton'
import EmailPassageRenderer from '@/components/ui/EmailPassageRenderer'

const CATEGORY_COLORS: Record<string, string> = {
  reading:   'bg-blue-100 text-blue-700',
  listening: 'bg-emerald-100 text-emerald-700',
  speaking:  'bg-orange-100 text-orange-700',
  writing:   'bg-purple-100 text-purple-700',
}

export default async function SetPreviewPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return null

  const { groupId } = await params
  const { data: qs } = await supabase
    .from('questions')
    .select('*')
    .eq('passage_group_id', groupId)
    .eq('teacher_id', user.id)
    .eq('is_active', true)
    .order('set_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (!qs || qs.length === 0) notFound()

  type QRow = Question & { passage_group_id?: string; audio_script?: string | null; audio_url?: string | null; speaking_prompt?: string | null; vocab_words?: { word: string; def: string; example?: string }[] | null }
  const questions = qs as QRow[]
  const rep = questions[0]
  const diff = getDiffInfo(rep.difficulty)
  const subtypeLabel = QUESTION_SUBTYPE_LABELS[rep.category]?.[rep.question_subtype ?? '']
  const isListenRepeat = rep.question_subtype === 'listen_and_repeat'
  const isTakeInterview = rep.question_subtype === 'take_an_interview'

  return (
    <div className="p-4 md:p-7 max-w-3xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3">
          <Link href="/teacher/questions" className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-500">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">세트 미리보기</h1>
            <p className="text-xs text-gray-400 mt-0.5">문제 {questions.length}개 세트</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SetDeleteButton groupId={groupId} questionIds={questions.map(q => q.id)} />
        </div>
      </div>

      {/* 메타 배지 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${CATEGORY_COLORS[rep.category] ?? 'bg-gray-100 text-gray-600'}`}>
          {CATEGORY_LABELS[rep.category] ?? rep.category}
        </span>
        {subtypeLabel && (
          <span className="text-xs font-medium px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full">
            {subtypeLabel}
          </span>
        )}
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${diff.color}`}>
          {diff.cefr} {diff.label} {diff.name}
        </span>
        {rep.source === 'ai_generated' && (
          <span className="text-xs px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">AI 생성</span>
        )}
        <span className="text-xs px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full font-bold">
          {questions.length}문제 세트
        </span>
      </div>

      {/* Take an Interview: 인터뷰 소개 지문 */}
      {isTakeInterview && (
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 mb-6">
          <p className="text-xs font-bold text-orange-500 uppercase tracking-wide mb-2">인터뷰 소개 (공유)</p>
          <p className="text-sm text-orange-900 leading-7">{rep.passage ?? '(소개 지문 없음)'}</p>
        </div>
      )}

      {/* Listen & Repeat: Set title + 공유 지시문 */}
      {isListenRepeat && (
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 mb-6">
          <p className="text-xs font-bold text-orange-500 uppercase tracking-wide mb-1">세트 타이틀</p>
          <p className="text-base font-bold text-orange-900 mb-3">{rep.passage ?? '(세트 미지정)'}</p>
          <div className="border-t border-orange-100 pt-3">
            <p className="text-xs font-bold text-orange-500 uppercase tracking-wide mb-1">공유 지시문</p>
            <p className="text-sm text-orange-800 font-medium">{rep.content}</p>
          </div>
        </div>
      )}

      {/* 리스닝: 음성 스크립트 + 플레이어 (공유) */}
      {rep.category === 'listening' && (rep.audio_script || rep.audio_url) && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 size={16} className="text-emerald-600" />
              <p className="text-sm font-bold text-emerald-700">음성 스크립트 (공유)</p>
            </div>
            {!rep.audio_url && (
              <Link href={`/teacher/questions/${rep.id}/edit`}
                className="text-xs text-emerald-700 bg-emerald-100 px-3 py-1 rounded-lg font-semibold hover:bg-emerald-200 transition">
                + AI 음성 생성
              </Link>
            )}
          </div>
          {rep.audio_url && (
            <audio controls src={rep.audio_url} className="w-full rounded-xl" />
          )}
          {rep.audio_script && (
            <p className="text-sm text-emerald-900 whitespace-pre-wrap leading-7">{rep.audio_script}</p>
          )}
        </div>
      )}

      {/* 리스닝 없음 알림 */}
      {rep.category === 'listening' && !rep.audio_script && !rep.audio_url && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-center justify-between">
          <p className="text-sm text-amber-700">음성 스크립트가 없습니다. 수정에서 스크립트를 입력하고 AI 음성을 생성하세요.</p>
          <Link href={`/teacher/questions/${rep.id}/edit`}
            className="text-xs text-amber-700 bg-amber-100 px-3 py-1 rounded-lg font-semibold hover:bg-amber-200 transition whitespace-nowrap ml-3">
            수정하기
          </Link>
        </div>
      )}

      {/* 지문 (리딩, listen_and_repeat, take_an_interview 제외) */}
      {rep.category !== 'listening' && !isListenRepeat && !isTakeInterview && rep.passage && (
        (rep.question_subtype === 'daily_life_email' || rep.question_subtype === 'daily_life_campus_email') ? (
          <div className="mb-6">
            <p className="text-xs font-bold text-amber-700 mb-2 uppercase tracking-wide">지문 (공유)</p>
            <EmailPassageRenderer text={rep.passage} />
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 mb-6">
            <p className="text-xs font-bold text-amber-700 mb-3 uppercase tracking-wide">지문 (공유)</p>
            <p className="text-gray-800 text-sm leading-7 whitespace-pre-wrap">{rep.passage}</p>
          </div>
        )
      )}

      {/* 문제 목록 */}
      <div className="space-y-4">
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* 문제 헤더 */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <SetOrderButtons
                  questionId={q.id}
                  idx={idx}
                  total={questions.length}
                  allIds={questions.map(q => q.id)}
                />
                <span className="text-sm font-bold text-gray-700">문제 {idx + 1}</span>
              </div>
              <div className="flex gap-1.5">
                <Link href={`/teacher/questions/${q.id}`}
                  className="px-3 py-1 text-xs font-semibold bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition">
                  미리보기
                </Link>
                <Link href={`/teacher/questions/${q.id}/edit`}
                  className="flex items-center gap-1 px-3 py-1 text-xs font-semibold border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                  <Pencil size={11} /> 수정
                </Link>
                <DeleteButton id={q.id} />
              </div>
            </div>

            {/* 문제 내용 */}
            <div className="px-5 py-4">
              {isListenRepeat ? (
                /* Listen & Repeat: 문장(audio_script) + TTS 상태 */
                <div className="space-y-2">
                  <p className="text-sm text-gray-900 leading-7 font-medium">{q.audio_script ?? '(문장 없음)'}</p>
                  {q.audio_script && (
                    <TtsAutoButton
                      questionId={q.id}
                      audioScript={q.audio_script}
                      initialAudioUrl={q.audio_url ?? null}
                    />
                  )}
                </div>
              ) : isTakeInterview ? (
                /* Take an Interview: 질문 텍스트(content) + TTS 상태 */
                <div className="space-y-2">
                  <p className="text-sm text-gray-900 leading-7 font-medium whitespace-pre-wrap">{q.content}</p>
                  {((q as QRow).speaking_prompt ?? q.content) && (
                    <TtsAutoButton
                      questionId={q.id}
                      audioScript={(q as QRow).speaking_prompt ?? q.content ?? ''}
                      initialAudioUrl={q.audio_url ?? null}
                    />
                  )}
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-900 leading-7 font-medium whitespace-pre-wrap">{q.content}</p>
                  {/* 선택지 */}
                  {Array.isArray(q.options) && (q.options as { num: number; text: string }[]).length > 0 && (
                    <div className="mt-3 space-y-2">
                      {(q.options as { num: number; text: string }[]).map(opt => (
                        <div key={opt.num} className="flex items-start gap-3 p-2.5 rounded-xl border border-gray-100">
                          <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded-full text-xs font-bold text-gray-600">
                            {optionLabel(opt.num, usesAlphaOptions(q.category, q.question_subtype))}
                          </span>
                          <span className="text-sm text-gray-800">{opt.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 정답/해설 */}
            <details className="border-t border-gray-100">
              <summary className="px-5 py-3 cursor-pointer text-xs font-bold text-gray-500 select-none hover:bg-gray-50 transition list-none flex items-center gap-1.5">
                <span className="text-green-600">✓</span> 정답 및 해설 보기
              </summary>
              <div className="px-5 pb-4 space-y-2 pt-2">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">정답</p>
                  <p className="text-sm text-gray-900 font-mono bg-green-50 px-3 py-1.5 rounded-lg">
                    {usesAlphaOptions(q.category, q.question_subtype) && /^\d+$/.test(q.answer ?? '')
                      ? optionLabel(Number(q.answer), true)
                      : q.answer}
                  </p>
                </div>
                {q.explanation && (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">해설</p>
                    <p className="text-sm text-gray-700 leading-6 whitespace-pre-wrap">{q.explanation}</p>
                  </div>
                )}
                {Array.isArray((q as QRow).vocab_words) && (q as QRow).vocab_words!.length > 0 && (
                  <VocabWords words={(q as QRow).vocab_words!} />
                )}
              </div>
            </details>
          </div>
        ))}
      </div>

      {/* AI 추가 문제 생성 — 문제 목록 하단 */}
      <div className="mt-4">
        <AIAddButton
          groupId={groupId}
          passage={rep.passage ?? null}
          category={rep.category}
          questionSubtype={rep.question_subtype ?? null}
          difficulty={rep.difficulty}
        />
      </div>
    </div>
  )
}
