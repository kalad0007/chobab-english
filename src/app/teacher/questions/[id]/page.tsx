import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CATEGORY_LABELS, QUESTION_SUBTYPE_LABELS, getDiffInfo, usesAlphaOptions, optionLabel } from '@/lib/utils'
import { ArrowLeft, Pencil, Volume2 } from 'lucide-react'
import type { Question } from '@/types/database'
import BuildASentencePlayer from '@/components/ui/BuildASentencePlayer'
import VocabWords from '@/components/ui/VocabWords'
import EmailPassageRenderer from '@/components/ui/EmailPassageRenderer'

const CATEGORY_COLORS: Record<string, string> = {
  reading:   'bg-blue-100 text-blue-700',
  listening: 'bg-emerald-100 text-emerald-700',
  speaking:  'bg-orange-100 text-orange-700',
  writing:   'bg-purple-100 text-purple-700',
}

// fill-blank 위저드가 저장한 JSON 토큰 파싱
interface Token { id: string; type: string; text: string; isBlank: boolean; showLetters: number }

function groupSentences(tokens: Token[]): Token[][] {
  const groups: Token[][] = []
  let cur: Token[] = []
  tokens.forEach(t => {
    cur.push(t)
    if (t.type === 'nonword' && t.text.includes('\n')) { groups.push(cur); cur = [] }
  })
  if (cur.length) groups.push(cur)
  return groups.filter(g => g.some(t => t.type === 'word'))
}

function renderBlankToken(t: Token) {
  const w = t.text.replace(/[^a-zA-Z]/g, '')
  const shown = w.slice(0, t.showLetters)
  const blanks = '_'.repeat(Math.max(0, w.length - t.showLetters))
  return (
    <span key={t.id} className="font-bold text-blue-600 bg-blue-50 rounded px-0.5">
      {shown}{blanks}
    </span>
  )
}

function renderPassage(passage: string | null, subtype?: string | null): React.ReactNode {
  if (!passage) return null
  if (passage.startsWith('[') || passage.startsWith('{')) {
    try {
      const tokens: Token[] = JSON.parse(passage)

      if (subtype === 'sentence_completion') {
        return (
          <div className="space-y-2">
            {groupSentences(tokens).map((sent, si) => (
              <div key={si} className="flex items-baseline gap-3">
                <span className="text-xs font-bold text-gray-400 w-6 flex-shrink-0 text-right">{si + 1}.</span>
                <p className="text-gray-800 leading-8 font-mono text-sm">
                  {sent.map(t => {
                    const display = t.text.replace(/\n/g, '')
                    if (!t.isBlank) return display ? <span key={t.id}>{display}</span> : null
                    return renderBlankToken(t)
                  })}
                </p>
              </div>
            ))}
          </div>
        )
      }

      return (
        <p className="text-gray-800 leading-8 font-mono text-sm">
          {tokens.map(t => {
            if (!t.isBlank) return <span key={t.id}>{t.text}</span>
            return renderBlankToken(t)
          })}
        </p>
      )
    } catch { /* not JSON, fall through */ }
  }
  return <p className="text-gray-800 text-sm leading-7 whitespace-pre-wrap">{passage}</p>
}

export default async function QuestionPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return null

  const { id } = await params
  const { data: q } = await supabase
    .from('questions')
    .select('*')
    .eq('id', id)
    .eq('teacher_id', user.id)
    .single()

  if (!q) notFound()

  const question = q as Question & { audio_script?: string; speaking_prompt?: string; passage_group_id?: string | null }
  const diff = getDiffInfo(question.difficulty)
  const subtypeLabel = QUESTION_SUBTYPE_LABELS[question.category]?.[question.question_subtype ?? '']
  const isFillBlank = question.question_subtype === 'complete_the_words' || question.question_subtype === 'sentence_completion'
  const isSentenceReordering = question.question_subtype === 'sentence_reordering'

  // fill-blank 메타 파싱 (위저드 저장 포맷: {title, timeLimit, format, explanation})
  let fbMeta: { title?: string; timeLimit?: number; explanation?: string } = {}
  let explanationText = question.explanation ?? ''
  let krTranslation = ''  // academic_discussion / email_writing 한글 번역
  if (isFillBlank) {
    const rawExp = question.explanation ?? ''
    if (rawExp.startsWith('{')) {
      try {
        const parsed = JSON.parse(rawExp)
        if (parsed.format !== undefined) {
          fbMeta = parsed
          explanationText = parsed.explanation ?? ''
        }
      } catch { /* ignore */ }
    }
  } else if (question.question_subtype === 'academic_discussion' || question.question_subtype === 'email_writing') {
    const KR_DELIMITER = '\n\n===번역==='
    const parts = (question.explanation ?? '').split(KR_DELIMITER)
    explanationText = parts[0].trim()
    krTranslation = parts[1]?.replace(/^\n\n/, '').trim() ?? ''
  }

  return (
    <div className="p-4 md:p-7 max-w-3xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3">
          <Link href="/teacher/questions" className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-500">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">문제 미리보기</h1>
            <p className="text-xs text-gray-400 mt-0.5">학생이 보는 방식으로 표시됩니다</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {question.passage_group_id && (
            <Link href={`/teacher/questions/set/${question.passage_group_id}`}
              className="flex items-center gap-1.5 px-3 py-2 border border-indigo-200 text-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-50 transition">
              세트 전체 보기
            </Link>
          )}
          <Link href={`/teacher/questions/${id}/edit`}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold hover:bg-gray-50 transition">
            <Pencil size={14} /> 수정
          </Link>
        </div>
      </div>

      {/* 메타 배지 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${CATEGORY_COLORS[question.category] ?? 'bg-gray-100 text-gray-600'}`}>
          {CATEGORY_LABELS[question.category] ?? question.category}
        </span>
        {subtypeLabel && (
          <span className="text-xs font-medium px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full">
            {subtypeLabel}
          </span>
        )}
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${diff.color}`}>
          {diff.cefr} {diff.label} {diff.name}
        </span>
        {question.source === 'ai_generated' && (
          <span className="text-xs px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">AI 생성</span>
        )}
      </div>

      {/* 리스닝/스피킹 음성 스크립트 + 재생 — 문제보다 위 */}
      {(question.category === 'listening' || question.category === 'speaking') && (question.audio_script || (question as Question & { audio_url?: string }).audio_url) && (
        <div className={`border rounded-2xl p-5 mb-4 space-y-3 ${question.category === 'speaking' ? 'bg-orange-50 border-orange-100' : 'bg-emerald-50 border-emerald-100'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 size={16} className={question.category === 'speaking' ? 'text-orange-600' : 'text-emerald-600'} />
              <p className={`text-sm font-bold ${question.category === 'speaking' ? 'text-orange-700' : 'text-emerald-700'}`}>
                {question.category === 'speaking' ? '음성 (스피킹)' : '음성 스크립트'}
              </p>
            </div>
            {!(question as Question & { audio_url?: string }).audio_url && (
              <Link href={`/teacher/questions/${question.id}/edit`}
                className={`text-xs px-3 py-1 rounded-lg font-semibold transition ${question.category === 'speaking' ? 'text-orange-700 bg-orange-100 hover:bg-orange-200' : 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200'}`}>
                + AI 음성 생성
              </Link>
            )}
          </div>
          {(question as Question & { audio_url?: string }).audio_url && (
            <audio controls src={(question as Question & { audio_url?: string }).audio_url} className="w-full rounded-xl" />
          )}
          {question.audio_script && (
            <p className={`text-sm whitespace-pre-wrap leading-7 ${question.category === 'speaking' ? 'text-orange-900' : 'text-emerald-900'}`}>{question.audio_script}</p>
          )}
        </div>
      )}

      {/* fill-blank 타이틀 */}
      {isFillBlank && fbMeta.title && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <h2 className="text-lg font-bold text-gray-900">{fbMeta.title}</h2>
          {fbMeta.timeLimit && (
            <p className="text-xs text-gray-400 mt-1">제한시간 {fbMeta.timeLimit}분</p>
          )}
        </div>
      )}

      {/* sentence_reordering: 워드 타일 미리보기 */}
      {isSentenceReordering && Array.isArray(question.options) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <BuildASentencePlayer
            personAQuestion={question.content}
            wordTiles={question.options as { num: number; text: string }[]}
            readonly={true}
            correctAnswer={question.answer}
          />
        </div>
      )}

      {/* fill-blank 위저드: passage(JSON 토큰) 렌더링 — content와 중복이므로 passage만 표시 */}
      {!isSentenceReordering && isFillBlank && question.passage ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
            {question.question_subtype === 'sentence_completion' ? '문장 목록 (빈칸 채우기)' : '단락 (빈칸 채우기)'}
          </p>
          {renderPassage(question.passage, question.question_subtype)}
        </div>
      ) : !isSentenceReordering && !isFillBlank && question.passage && question.question_subtype !== 'email_writing' && question.question_subtype !== 'listen_and_repeat' ? (
        (question.question_subtype === 'daily_life_email' || question.question_subtype === 'daily_life_campus_email') ? (
          <div className="mb-4">
            <EmailPassageRenderer text={question.passage} />
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 mb-4">
            <p className="text-xs font-bold text-amber-700 mb-3 uppercase tracking-wide">지문</p>
            {renderPassage(question.passage, question.question_subtype)}
          </div>
        )
      ) : null}

      {/* 문제 (sentence_reordering / fill-blank 위저드는 위에서 이미 표시) */}
      {!isSentenceReordering && (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
          {isFillBlank
            ? (question.question_subtype === 'sentence_completion' ? '문장 목록 (빈칸 채우기)' : '단락 (빈칸 채우기)')
            : '문제'}
        </p>
        {/* fill-blank 위저드는 passage로 이미 표시했으므로 content 숨김 */}
        {!(isFillBlank && question.passage) && (
          question.question_subtype === 'sentence_completion' ? (() => {
            const sentences = (question.content || '').split('\n').filter(Boolean)
            const answerWords = (question.answer || '').split(',').map(a => a.trim())
            return (
              <div className="space-y-2">
                {sentences.map((sentence, i) => {
                  // If content already has hint letters (e.g. lea___), use as-is; otherwise auto-add 3-char hint
                  const alreadyHinted = /[a-zA-Z']+_{2,}/.test(sentence)
                  const hint = !alreadyHinted && answerWords[i] ? answerWords[i].slice(0, 3) : ''
                  const displayed = alreadyHinted
                    ? sentence
                    : hint ? sentence.replace(/_{2,}/, `${hint}___`) : sentence
                  return (
                    <div key={i} className="flex items-baseline gap-3">
                      <span className="text-xs font-bold text-gray-400 w-6 flex-shrink-0 text-right">{i + 1}.</span>
                      <span className="text-sm text-gray-900 leading-7 font-mono">{displayed}</span>
                    </div>
                  )
                })}
              </div>
            )
          })() : (
            <p className="text-gray-900 text-sm leading-7 whitespace-pre-wrap font-medium break-words">
              {question.content}
            </p>
          )
        )}
        {isFillBlank && question.passage && (
          <p className="text-xs text-gray-400 italic">
            {question.question_subtype === 'sentence_completion' ? '위 문장들에서 빈칸을 채우세요.' : '위 단락에서 빈칸을 채우세요.'}
          </p>
        )}

        {/* MCQ 보기 */}
        {Array.isArray(question.options) && (question.options as { num: number; text: string }[]).length > 0 && (() => {
          const alpha = usesAlphaOptions(question.category, question.question_subtype)
          return (
          <div className="mt-4 space-y-2">
            {(question.options as { num: number; text: string }[]).map(opt => (
              <div key={opt.num} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition cursor-default">
                <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded-full text-xs font-bold text-gray-600">
                  {optionLabel(opt.num, alpha)}
                </span>
                <span className="text-sm text-gray-800">{opt.text}</span>
              </div>
            ))}
          </div>
          )
        })()}

        {/* Speaking 프롬프트 — listen_and_repeat는 audio_script와 동일하므로 생략 */}
        {question.speaking_prompt && question.question_subtype !== 'listen_and_repeat' && (
          <div className="mt-4 p-4 bg-orange-50 rounded-xl border border-orange-100">
            <p className="text-xs font-bold text-orange-700 mb-2">🎤 말하기 프롬프트</p>
            <p className="text-sm text-orange-900">{question.speaking_prompt}</p>
          </div>
        )}
      </div>
      )}

      {/* 정답 + 해설 */}
      <details className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <summary className="px-5 py-4 cursor-pointer text-sm font-bold text-gray-700 select-none hover:bg-gray-50 transition list-none flex items-center gap-2">
          <span className="text-green-600">✓</span> 정답 및 해설 보기
        </summary>
        <div className="px-5 pb-5 space-y-3 border-t border-gray-100 pt-4">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">
              {(question.question_subtype === 'email_writing' || question.question_subtype === 'academic_discussion') ? '모범 답안' : '정답'}
            </p>
            {(question.question_subtype === 'email_writing' || question.question_subtype === 'academic_discussion') ? (
              <p className="text-sm text-gray-900 bg-green-50 px-3 py-2.5 rounded-lg whitespace-pre-wrap leading-6">{question.answer}</p>
            ) : (
              <p className="text-sm text-gray-900 font-mono bg-green-50 px-3 py-2 rounded-lg">
                {isFillBlank
                  ? (question.answer ?? '').split(',').map((a, i) => (
                      <span key={i} className="inline-block mr-2 mb-1 bg-green-100 text-green-800 px-2 py-0.5 rounded font-semibold text-xs">{i+1}. {a.trim()}</span>
                    ))
                  : usesAlphaOptions(question.category, question.question_subtype) && /^\d+$/.test(question.answer ?? '')
                    ? optionLabel(Number(question.answer), true)
                    : question.answer}
              </p>
            )}
          </div>
          {/* email_writing / academic_discussion 한글 번역 */}
          {(question.question_subtype === 'email_writing' || question.question_subtype === 'academic_discussion') && (krTranslation || (question.question_subtype === 'email_writing' && question.passage)) && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">한글 번역</p>
              <p className="text-sm text-gray-700 bg-blue-50 px-3 py-2.5 rounded-lg whitespace-pre-wrap leading-6">
                {krTranslation || question.passage}
              </p>
            </div>
          )}
          {explanationText && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">해설</p>
              <p className="text-sm text-gray-700 leading-6 whitespace-pre-wrap">{explanationText}</p>
            </div>
          )}
          {(question as Question & { vocab_words?: { word: string; def: string; example?: string }[] | null }).vocab_words?.length ? (
            <VocabWords words={(question as Question & { vocab_words?: { word: string; def: string; example?: string }[] | null }).vocab_words!} defaultOpen />
          ) : null}
        </div>
      </details>
    </div>
  )
}
