import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
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

function getDiffDesc(d: number): string {
  if (d >= 5.5) return 'C2 수준 (TOEFL 115-120점)'
  if (d >= 5.0) return 'C1 수준 (TOEFL 100-115점)'
  if (d >= 4.5) return 'B2+ 수준 (TOEFL 90-100점)'
  if (d >= 4.0) return 'B2 수준 (TOEFL 80-90점)'
  if (d >= 3.5) return 'B1+ 수준 (TOEFL 70-80점)'
  if (d >= 3.0) return 'B1 수준 (TOEFL 60-70점)'
  if (d >= 2.0) return 'A2 수준 (TOEFL 45-60점)'
  return 'A1 수준 (TOEFL 30-45점)'
}

function buildPrompt(category: string, subtype: string, difficulty: number, count: number, topic: string, questionsPerPassage: number = 1, wordCount: number = 0, passageContext: string = '', acadDiscWords: { prof: number; studentA: number; studentB: number; answer: number } | null = null): string {
  const diffDesc = getDiffDesc(difficulty)
  const topicNote = topic ? `주제/소재: ${topic}` : ''
  const passageContextNote = passageContext
    ? `\n\n【기존 지문/스크립트 (반드시 이 내용을 기반으로 새 문제를 만드세요)】\n${passageContext}\n\n위 지문/스크립트를 활용하여 새로운 문제를 만드세요. passage 필드에는 위 지문과 동일한 내용을 넣으세요.`
    : ''
  const n = count
  const qpp = questionsPerPassage

  // Per-subtype word/message count defaults (teacher-adjustable via wordCount param)
  const wc1  = wordCount > 0 ? wordCount : 100   // complete_the_words passage
  const wc3  = wordCount > 0 ? wordCount : 80    // daily_life_email body
  const mc4  = wordCount > 0 ? wordCount : 8     // daily_life_text_chain messages
  const wc5  = wordCount > 0 ? wordCount : 220   // academic_passage
  const wc7  = wordCount > 0 ? wordCount : 80    // conversation script
  const wc8  = wordCount > 0 ? wordCount : 150   // academic_talk / campus_announcement script
  const wc9  = wordCount > 0 ? wordCount : 10    // sentence_reordering answer words
  const wc10 = wordCount > 0 ? wordCount : 150   // email_writing model answer
  const adw = { prof: 100, studentA: 70, studentB: 70, answer: 100, ...acadDiscWords }  // academic_discussion per-section word counts

  const subtypePrompts: Record<string, string> = {
    complete_the_words: `TOEFL "Complete the Words" (단락형 빈칸) 문제를 ${Math.max(n, qpp)}개 생성하세요.
- ${wc1}단어의 학술 단락, 두번째 문장부터 특정 단어의 앞 2-4글자를 보여주고 나머지를 언더스코어로 마스킹 (예: te___, bel____, sur_____)
- 빈칸 8-12개 골고루 배치
- content 필드에 빈칸이 포함된 단락 전체를 넣으세요
- answer 필드에는 빈칸에 들어갈 완성된 단어들을 쉼표로 구분하여 순서대로 나열하세요 (예: "tends,believe,surface,...")
- 난이도: ${diffDesc} ${topicNote}
- difficulty 값은 반드시 ${difficulty}를 사용하세요
- question_subtype은 반드시 "complete_the_words"로 설정하세요
- category는 반드시 "reading"으로 설정하세요

반드시 다음 JSON 형식으로만 응답 (마크다운 코드블록 없이 순수 JSON):
{"questions":[{"content":"단락 텍스트 (te___ blanks 포함)","passage":null,"options":null,"answer":"tends,believe,surface","explanation":"각 빈칸 해설","category":"reading","difficulty":${difficulty},"question_subtype":"complete_the_words","audio_script":null,"speaking_prompt":null}]}`,

    sentence_completion: `TOEFL "Sentence Completion" (문장 세트 빈칸) 문제 ${Math.max(n, qpp)}개를 생성하세요.
- 서로 내용이 이어지지 않는 독립적인 짧은 영어 문장 10개를 하나의 세트로 구성
- 각 문장마다 ___ 빈칸 1개 포함 (문법/어휘 테스트)
- content 필드에 10개 문장을 줄바꿈(\\n)으로 구분하여 넣으세요
- answer 필드에는 빈칸에 들어갈 단어를 순서대로 쉼표로 구분하여 나열하세요 (예: "stayed,required,established,...")
- 난이도: ${diffDesc} ${topicNote}
- difficulty 값은 반드시 ${difficulty}를 사용하세요
- question_subtype은 반드시 "sentence_completion"으로 설정하세요
- category는 반드시 "reading"으로 설정하세요

반드시 다음 JSON 형식으로만 응답 (마크다운 코드블록 없이 순수 JSON):
{"questions":[{"content":"The scientist ___ to work late every night.\\nThe professor ___ her students to submit essays early.\\nThe company ___ a new office building downtown last year.\\nResearchers ___ that the treatment was highly effective.\\nThe government ___ stricter regulations on air pollution.\\nMany students ___ extra time to prepare for final exams.\\nThe athlete ___ months of rigorous training before the event.\\nShe ___ a full scholarship to study at a top university.\\nThe committee ___ a decision after hours of debate.\\nHe ___ his team with a detailed progress report.","passage":null,"options":null,"answer":"stayed,encouraged,constructed,found,introduced,dedicated,completed,received,reached,impressed","explanation":"각 빈칸의 단어 의미 및 문법 설명...","category":"reading","difficulty":${difficulty},"question_subtype":"sentence_completion","audio_script":null,"speaking_prompt":null}]}`,

    daily_life_email: `TOEFL "Read in Daily Life - Email" 문제 세트 ${n}개를 생성하세요.
- 격식체 이메일 ${n}개를 생성하고, 각 이메일마다 ${qpp}개의 독해 문제를 만드세요
- 총 ${n * qpp}개의 문제 객체를 questions 배열에 포함하세요
- 같은 이메일에 대한 ${qpp}개 문제는 동일한 passage 값을 사용하세요
- passage 필드에 이메일 전체를 실제 줄바꿈(\\n)을 사용하여 넣으세요 (이메일 본문 ${wc3}단어)
- 이메일 형식: "From: name@email.com\\nTo: name@email.com\\nDate: [날짜]\\nSubject: [제목]\\n\\nDear [이름],\\n\\n[본문 단락]\\n\\n[본문 단락2]\\n\\nBest regards,\\n[발신자]"
- 반드시 Dear ...와 본문 사이, 단락과 단락 사이, 본문과 서명 사이를 빈 줄(\\n\\n)로 구분하세요
- 각 이메일에 대해 다양한 질문 유형: 이메일 목적, 특정 정보, 어조/태도, 추론 등
- options는 반드시 4개를 포함해야 합니다
- answer는 정답 번호를 문자열로 (예: "2")
- 난이도: ${diffDesc} ${topicNote}
- difficulty 값은 반드시 ${difficulty}를 사용하세요
- question_subtype은 반드시 "daily_life_email"로 설정하세요
- category는 반드시 "reading"으로 설정하세요

반드시 다음 JSON 형식으로만 응답 (마크다운 코드블록 없이 순수 JSON):
{"questions":[{"content":"What is the main purpose of the email?","passage":"From: john@email.com\\nTo: manager@company.com\\nDate: March 15, 2025\\nSubject: Request for Meeting\\n\\nDear Manager,\\n\\n[이메일 본문 150-200단어]\\n\\nBest regards,\\nJohn","options":[{"num":1,"text":"..."},{"num":2,"text":"..."},{"num":3,"text":"..."},{"num":4,"text":"..."}],"answer":"2","explanation":"해설...","category":"reading","difficulty":${difficulty},"question_subtype":"daily_life_email","audio_script":null,"speaking_prompt":null},{"content":"두 번째 질문 (특정 정보/추론/어조 등)...","passage":"[same email passage]","options":[{"num":1,"text":"..."},{"num":2,"text":"..."},{"num":3,"text":"..."},{"num":4,"text":"..."}],"answer":"3","explanation":"해설...","category":"reading","difficulty":${difficulty},"question_subtype":"daily_life_email","audio_script":null,"speaking_prompt":null}]}`,

    daily_life_text_chain: `TOEFL "Read in Daily Life - Text Chain" 문제 세트 ${n}개를 생성하세요.
- 스마트폰 그룹 채팅 ${n}개를 생성하고, 각 채팅마다 ${qpp}개의 독해 문제를 만드세요
- 총 ${n * qpp}개의 문제 객체를 questions 배열에 포함하세요
- 같은 채팅에 대한 ${qpp}개 문제는 동일한 passage 값을 사용하세요
- 스마트폰 그룹 채팅 형식 (3-4명, ${mc4}개 메시지)
- 반드시 "[HH:MM AM/PM] 이름: 메시지" 형식 사용
- passage 필드에 채팅 전체를 실제 줄바꿈(\\n)으로 구분하여 넣으세요
- 각 채팅에 대해 다양한 질문 유형: 특정 화자의 의도, 다음 행동, 채팅의 목적, 세부 정보 등
- options는 반드시 4개를 포함해야 합니다
- answer는 정답 번호를 문자열로 (예: "1")
- 난이도: ${diffDesc} ${topicNote}
- difficulty 값은 반드시 ${difficulty}를 사용하세요
- question_subtype은 반드시 "daily_life_text_chain"으로 설정하세요
- category는 반드시 "reading"으로 설정하세요

반드시 다음 JSON 형식으로만 응답 (마크다운 코드블록 없이 순수 JSON):
{"questions":[{"content":"What will Jake most likely do next?","passage":"[9:00 AM] Jake: Hey everyone, are we still meeting today?\\n[9:02 AM] Sarah: I think so, where should we go?\\n[9:03 AM] Mike: How about the library?\\n[9:05 AM] Jake: Sounds good. See you at 2 PM!","options":[{"num":1,"text":"..."},{"num":2,"text":"..."},{"num":3,"text":"..."},{"num":4,"text":"..."}],"answer":"1","explanation":"해설...","category":"reading","difficulty":${difficulty},"question_subtype":"daily_life_text_chain","audio_script":null,"speaking_prompt":null},{"content":"두 번째 질문 (목적/세부정보/추론 등)...","passage":"[same chat passage]","options":[{"num":1,"text":"..."},{"num":2,"text":"..."},{"num":3,"text":"..."},{"num":4,"text":"..."}],"answer":"2","explanation":"해설...","category":"reading","difficulty":${difficulty},"question_subtype":"daily_life_text_chain","audio_script":null,"speaking_prompt":null}]}`,

    daily_life_notice: `TOEFL "Read in Daily Life - Notice" 문제 세트 ${n}개를 생성하세요.
- 공식 공지문 ${n}개를 생성하고, 각 공지마다 ${qpp}개의 독해 문제를 만드세요
- 총 ${n * qpp}개의 문제 객체를 questions 배열에 포함하세요
- 같은 공지문에 대한 ${qpp}개 문제는 동일한 passage 값을 사용하세요
- 공지문 형식: 제목, 날짜, 기관명, 본문 (${wc3}단어). 규정·정책·안내 내용
- passage 필드에 공지문 전체를 실제 줄바꿈(\\n)으로 넣으세요
- 각 공지에 대해 다양한 질문 유형: 공지 목적, 특정 규정/조건, 대상자, 추론 등
- options는 반드시 4개를 포함해야 합니다
- answer는 정답 번호를 문자열로 (예: "2")
- 난이도: ${diffDesc} ${topicNote}
- difficulty 값은 반드시 ${difficulty}를 사용하세요
- question_subtype은 반드시 "daily_life_notice"로 설정하세요
- category는 반드시 "reading"으로 설정하세요

반드시 다음 JSON 형식으로만 응답 (마크다운 코드블록 없이 순수 JSON):
{"questions":[{"content":"What is the main purpose of this notice?","passage":"NOTICE\\nDate: March 10, 2025\\nFrom: Building Management\\n\\n[공지문 본문 ${wc3}단어]","options":[{"num":1,"text":"..."},{"num":2,"text":"..."},{"num":3,"text":"..."},{"num":4,"text":"..."}],"answer":"2","explanation":"해설...","category":"reading","difficulty":${difficulty},"question_subtype":"daily_life_notice","audio_script":null,"speaking_prompt":null}]}`,

    daily_life_guide: `TOEFL "Read in Daily Life - Guide" 문제 세트 ${n}개를 생성하세요.
- 가이드/매뉴얼 ${n}개를 생성하고, 각 가이드마다 ${qpp}개의 독해 문제를 만드세요
- 총 ${n * qpp}개의 문제 객체를 questions 배열에 포함하세요
- 같은 가이드에 대한 ${qpp}개 문제는 동일한 passage 값을 사용하세요
- 가이드 형식: 제목, 단계별 안내 또는 섹션 구조, 본문 (${wc3}단어). How-to, 사용 설명서, 절차 안내
- passage 필드에 가이드 전체를 실제 줄바꿈(\\n)으로 넣으세요
- 각 가이드에 대해 다양한 질문 유형: 특정 단계/조건, 목적, 주의사항, 추론 등
- options는 반드시 4개를 포함해야 합니다
- answer는 정답 번호를 문자열로 (예: "3")
- 난이도: ${diffDesc} ${topicNote}
- difficulty 값은 반드시 ${difficulty}를 사용하세요
- question_subtype은 반드시 "daily_life_guide"로 설정하세요
- category는 반드시 "reading"으로 설정하세요

반드시 다음 JSON 형식으로만 응답 (마크다운 코드블록 없이 순수 JSON):
{"questions":[{"content":"According to the guide, what should you do first?","passage":"How to Register for Online Banking\\n\\nStep 1: [단계 내용]\\nStep 2: [단계 내용]\\n[가이드 본문 ${wc3}단어 계속]","options":[{"num":1,"text":"..."},{"num":2,"text":"..."},{"num":3,"text":"..."},{"num":4,"text":"..."}],"answer":"3","explanation":"해설...","category":"reading","difficulty":${difficulty},"question_subtype":"daily_life_guide","audio_script":null,"speaking_prompt":null}]}`,

    daily_life_article: `TOEFL "Read in Daily Life - Article" 문제 세트 ${n}개를 생성하세요.
- 짧은 기사 ${n}개를 생성하고, 각 기사마다 ${qpp}개의 독해 문제를 만드세요
- 총 ${n * qpp}개의 문제 객체를 questions 배열에 포함하세요
- 같은 기사에 대한 ${qpp}개 문제는 동일한 passage 값을 사용하세요
- 기사 형식: 헤드라인, 부제목(옵션), 날짜, 본문 (${wc3}단어). 뉴스·잡지 스타일
- passage 필드에 기사 전체를 실제 줄바꿈(\\n)으로 넣으세요
- 각 기사에 대해 다양한 질문 유형: 기사 주제, 특정 사실, 어조, 추론, 어휘 등
- options는 반드시 4개를 포함해야 합니다
- answer는 정답 번호를 문자열로 (예: "1")
- 난이도: ${diffDesc} ${topicNote}
- difficulty 값은 반드시 ${difficulty}를 사용하세요
- question_subtype은 반드시 "daily_life_article"로 설정하세요
- category는 반드시 "reading"으로 설정하세요

반드시 다음 JSON 형식으로만 응답 (마크다운 코드블록 없이 순수 JSON):
{"questions":[{"content":"What is the article mainly about?","passage":"City Council Plans Major Transportation Overhaul\\nMarch 10, 2025\\n\\n[기사 본문 ${wc3}단어]","options":[{"num":1,"text":"..."},{"num":2,"text":"..."},{"num":3,"text":"..."},{"num":4,"text":"..."}],"answer":"1","explanation":"해설...","category":"reading","difficulty":${difficulty},"question_subtype":"daily_life_article","audio_script":null,"speaking_prompt":null}]}`,

    daily_life_campus_notice: `TOEFL "Read in Daily Life - Campus Notice" 문제 세트 ${n}개를 생성하세요.
- 대학 교내 공지문 ${n}개를 생성하고, 각 공지마다 ${qpp}개의 독해 문제를 만드세요
- 총 ${n * qpp}개의 문제 객체를 questions 배열에 포함하세요
- 같은 공지문에 대한 ${qpp}개 문제는 동일한 passage 값을 사용하세요
- 캠퍼스 공지 형식: 학교/부서명, 제목, 날짜, 본문 (${wc3}단어). 수강신청·행사·도서관·장학금·기숙사 등 대학 생활 주제
- passage 필드에 공지문 전체를 실제 줄바꿈(\\n)으로 넣으세요
- 각 공지에 대해 다양한 질문 유형: 공지 목적, 마감일/날짜, 대상 학생, 필요 조건, 추론 등
- options는 반드시 4개를 포함해야 합니다
- answer는 정답 번호를 문자열로 (예: "2")
- 난이도: ${diffDesc} ${topicNote}
- difficulty 값은 반드시 ${difficulty}를 사용하세요
- question_subtype은 반드시 "daily_life_campus_notice"로 설정하세요
- category는 반드시 "reading"으로 설정하세요

반드시 다음 JSON 형식으로만 응답 (마크다운 코드블록 없이 순수 JSON):
{"questions":[{"content":"What is the main purpose of this notice?","passage":"University of California\\nOffice of Academic Affairs\\n\\nImportant Notice Regarding Spring Registration\\nDate: March 10, 2025\\n\\n[공지문 본문 ${wc3}단어]","options":[{"num":1,"text":"..."},{"num":2,"text":"..."},{"num":3,"text":"..."},{"num":4,"text":"..."}],"answer":"2","explanation":"해설...","category":"reading","difficulty":${difficulty},"question_subtype":"daily_life_campus_notice","audio_script":null,"speaking_prompt":null}]}`,

    choose_response: `TOEFL "Listen and Choose a Response" 문제를 ${n}개 생성하세요.
- 짧은 한마디(질문 또는 평서문)를 듣고 가장 자연스러운 대답 선택
- audio_script 필드에 듣게 될 짧은 한마디 문장을 넣으세요
- content 필드에 지시문을 넣으세요 (예: "What is the best response to the statement?")
- options는 반드시 4개의 가능한 응답을 포함해야 합니다
- answer는 정답 번호를 문자열로 (예: "2")
- 난이도: ${diffDesc} ${topicNote}
- difficulty 값은 반드시 ${difficulty}를 사용하세요
- question_subtype은 반드시 "choose_response"로 설정하세요
- category는 반드시 "listening"으로 설정하세요

반드시 다음 JSON 형식으로만 응답 (마크다운 코드블록 없이 순수 JSON):
{"questions":[{"content":"What is the best response to the statement?","passage":null,"options":[{"num":1,"text":"That sounds terrible."},{"num":2,"text":"You should take a break."},{"num":3,"text":"I already finished mine."},{"num":4,"text":"The library is closed today."}],"answer":"2","explanation":"해설...","category":"listening","difficulty":${difficulty},"question_subtype":"choose_response","audio_script":"I can't believe how much homework we have tonight.","speaking_prompt":null}]}`,

    conversation: `Role: You are an expert TOEFL iBT listening test developer.
Task: Create ${n} campus conversation listening sets (${n} × ${qpp} questions = exactly ${n * qpp} question objects).
Constraints:
- Each dialogue script is exactly ${wc7} words (two people, campus daily life)
- Scripts use "A:" (female voice) and "B:" (male voice) labels, one turn per line
- Each set shares the same audio_script across its ${qpp} questions
- IMPORTANT: Only the FIRST question in each set includes the full audio_script. All other questions in the same set must use exactly "__SAME__" as the audio_script value (the system will fill it in automatically).
- options: exactly 4 choices; answer: correct option number as string (e.g. "1")
- Difficulty: ${diffDesc} ${topicNote}
- difficulty value must be ${difficulty}
- All question_subtype: "conversation", category: "listening"

Respond with pure JSON only (no markdown):
{"questions":[{"content":"What is the conversation mainly about?","passage":null,"options":[{"num":1,"text":"..."},{"num":2,"text":"..."},{"num":3,"text":"..."},{"num":4,"text":"..."}],"answer":"1","explanation":"해설...","category":"listening","difficulty":${difficulty},"question_subtype":"conversation","audio_script":"A: Excuse me, Professor Johnson. Do you have a moment?\\nB: Sure, come on in. What can I help you with?\\nA: [dialogue continues in A:/B: format, ${wc7} words total]","speaking_prompt":null},{"content":"두 번째 질문 (같은 대화)...","passage":null,"options":[{"num":1,"text":"..."},{"num":2,"text":"..."},{"num":3,"text":"..."},{"num":4,"text":"..."}],"answer":"2","explanation":"해설...","category":"listening","difficulty":${difficulty},"question_subtype":"conversation","audio_script":"__SAME__","speaking_prompt":null}]}`,

    academic_talk: `Role: You are an expert TOEFL iBT listening test developer.
Task: Create ${n} academic lecture listening sets (${n} × ${qpp} questions = exactly ${n * qpp} question objects).
Constraints:
- Each lecture script is exactly ${wc8} words (professor's monologue on an academic topic)
- Scripts are written in natural spoken English with "Today we're going to talk about..." style opening
- Each set shares the same audio_script across its ${qpp} questions
- IMPORTANT: Only the FIRST question in each set includes the full audio_script. All other questions in the same set must use exactly "__SAME__" as the audio_script value (the system will fill it in automatically).
- options: exactly 4 choices; answer: correct option number as string (e.g. "3")
- Difficulty: ${diffDesc} ${topicNote}
- difficulty value must be ${difficulty}
- All question_subtype: "academic_talk", category: "listening"

Respond with pure JSON only (no markdown):
{"questions":[{"content":"What is the main topic of the lecture?","passage":null,"options":[{"num":1,"text":"..."},{"num":2,"text":"..."},{"num":3,"text":"..."},{"num":4,"text":"..."}],"answer":"3","explanation":"해설...","category":"listening","difficulty":${difficulty},"question_subtype":"academic_talk","audio_script":"Today we're going to talk about... [full lecture script, ${wc8} words]","speaking_prompt":null},{"content":"두 번째 질문 (같은 강의)...","passage":null,"options":[{"num":1,"text":"..."},{"num":2,"text":"..."},{"num":3,"text":"..."},{"num":4,"text":"..."}],"answer":"1","explanation":"해설...","category":"listening","difficulty":${difficulty},"question_subtype":"academic_talk","audio_script":"__SAME__","speaking_prompt":null}]}`,

    campus_announcement: `Role: You are an expert TOEFL iBT listening test developer.
Task: Create ${n} campus announcement listening sets (${n} × ${qpp} questions = exactly ${n * qpp} question objects).
Constraints:
- Each announcement script is exactly ${wc8} words (campus official, staff, or student making a campus-life announcement — e.g. events, facilities, policies, deadlines)
- Scripts are written in natural spoken English as a single speaker monologue
- Each set shares the same audio_script across its ${qpp} questions
- IMPORTANT: Only the FIRST question in each set includes the full audio_script. All other questions in the same set must use exactly "__SAME__" as the audio_script value (the system will fill it in automatically).
- options: exactly 4 choices; answer: correct option number as string (e.g. "2")
- Difficulty: ${diffDesc} ${topicNote}
- difficulty value must be ${difficulty}
- All question_subtype: "campus_announcement", category: "listening"

Respond with pure JSON only (no markdown):
{"questions":[{"content":"What is the announcement mainly about?","passage":null,"options":[{"num":1,"text":"..."},{"num":2,"text":"..."},{"num":3,"text":"..."},{"num":4,"text":"..."}],"answer":"2","explanation":"해설...","category":"listening","difficulty":${difficulty},"question_subtype":"campus_announcement","audio_script":"Good afternoon, everyone. I'd like to make an announcement about... [full announcement script, ${wc8} words]","speaking_prompt":null},{"content":"두 번째 질문 (같은 공지)...","passage":null,"options":[{"num":1,"text":"..."},{"num":2,"text":"..."},{"num":3,"text":"..."},{"num":4,"text":"..."}],"answer":"3","explanation":"해설...","category":"listening","difficulty":${difficulty},"question_subtype":"campus_announcement","audio_script":"__SAME__","speaking_prompt":null}]}`,

    sentence_reordering: `TOEFL "Build a Sentence" (단어 배열) 문제를 ${n}개 생성하세요.
- 두 사람의 대화 형식: Person A가 질문하고 Person B가 답하는 구조
- content 필드에 Person A의 질문만 입력하세요 (자연스러운 일상 대화 질문, 1문장)
- options 필드에 Person B의 답변 단어들을 뒤섞인 순서로 넣으세요 (단어 1개씩, ${wc9}개)
- answer 필드에는 Person B의 올바른 완성 문장을 넣으세요
- 단어 순서가 실제로 뒤섞여 있어야 합니다 (정답 순서로 나열하지 마세요)
- 난이도: ${diffDesc} ${topicNote}
- difficulty 값은 반드시 ${difficulty}를 사용하세요
- question_subtype은 반드시 "sentence_reordering"으로 설정하세요
- category는 반드시 "writing"으로 설정하세요

반드시 다음 JSON 형식으로만 응답 (마크다운 코드블록 없이 순수 JSON):
{"questions":[{"content":"What did Paul ask about the music festival you went to?","passage":null,"options":[{"num":1,"text":"if"},{"num":2,"text":"wondering"},{"num":3,"text":"he"},{"num":4,"text":"to"},{"num":5,"text":"be"},{"num":6,"text":"were"},{"num":7,"text":"the"},{"num":8,"text":"tickets"}],"answer":"He was wondering if the tickets were to be sold out.","explanation":"간접의문문 구조: He was wondering + if + S + V","category":"writing","difficulty":${difficulty},"question_subtype":"sentence_reordering","audio_script":null,"speaking_prompt":null}]}`,

    email_writing: `TOEFL "Write an Email" 문제를 ${n}개 생성하세요.

【content 형식 — 아래 구조를 정확히 따르세요】
"[상황 설명 문단 (2-3문장)]\\n\\nWrite an email to [이름]. In your email, do the following:\\n• [조건 1]\\n• [조건 2]\\n• [조건 3]\\n\\nWrite as much as you can and in complete sentences."

【explanation 형식 — 모범 답안 + 채점 기준】
"To: [수신자 이름]\\nSubject: [이메일 제목]\\n\\n[${wc10}단어 이상의 모범 이메일 본문]\\n\\n---\\n채점 기준: 조건 3가지 충족, 격식체 이메일 형식, 논리적 구성"

【passage 필드 — 한글 번역】
"【문제 번역】\\n[content 전체 한글 번역]\\n\\n【모범 답안 번역】\\nTo: [수신자]\\nSubject: [제목 번역]\\n\\n[explanation 모범 답안 한글 번역]"

- answer는 null로 설정하세요 (에세이형 문제이므로 단일 정답 없음)
- options는 null로 설정하세요
- 난이도: ${diffDesc} ${topicNote}
- difficulty 값은 반드시 ${difficulty}를 사용하세요
- question_subtype은 반드시 "email_writing"으로 설정하세요
- category는 반드시 "writing"으로 설정하세요

반드시 다음 JSON 형식으로만 응답 (마크다운 코드블록 없이 순수 JSON):
{"questions":[{"content":"You recently invited your family to your house. Your next-door neighbor has sent you a message complaining about the noise. You want to apologize and reassure him that it will not happen again.\\n\\nWrite an email to your neighbor. In your email, do the following:\\n• Explain the reasons for the noise\\n• Apologize to your neighbor\\n• Describe what actions you will take\\n\\nWrite as much as you can and in complete sentences.","passage":"【문제 번역】\\n최근 가족을 집으로 초대했습니다. 옆집 이웃이 소음에 대해 불만을 담은 메시지를 보냈습니다. 사과하고 다시는 이런 일이 없을 것이라고 안심시키고 싶습니다.\\n\\n이웃에게 이메일을 작성하세요. 이메일에 다음을 포함하세요:\\n• 소음의 이유를 설명하세요\\n• 이웃에게 사과하세요\\n• 취할 조치를 설명하세요\\n\\n최대한 많이, 완전한 문장으로 작성하세요.\\n\\n【모범 답안 번역】\\nTo: 이웃\\nSubject: 소음에 대한 사과\\n\\n안녕하세요, [이름]씨,\\n\\n어젯밤 소음으로 불편을 드려 정말 죄송합니다. 가족 모임이 있었고 모두가 즐거운 시간을 보내다 보니 소음을 인지하지 못했습니다. 다음부터는 늦은 시간에 소음을 줄이고 모임은 일찍 마치도록 하겠습니다.\\n\\n다시 한번 사과드립니다.\\n[이름]","options":null,"answer":null,"explanation":"To: Neighbor\\nSubject: Apology for the noise\\n\\nDear [Name],\\n\\nI am truly sorry for the noise caused last night. We had a family gathering and everyone was enjoying themselves, so we did not realize how loud it had become. I completely understand how frustrating this must have been for you, especially late in the evening.\\n\\nI assure you that this will not happen again. In the future, I will make sure to keep the noise level down and end any gatherings earlier in the evening.\\n\\nOnce again, please accept my sincere apologies.\\n\\nBest regards,\\n[Your Name]\\n\\n---\\n채점 기준: 조건 3가지 충족 (이유 설명, 사과, 조치 설명), 격식체 이메일 형식 (To/Subject/인사/본문/맺음), 논리적 구성","category":"writing","difficulty":${difficulty},"question_subtype":"email_writing","audio_script":null,"speaking_prompt":null}]}`,

    academic_discussion: `TOEFL "Write for an Academic Discussion" 문제를 ${n}개 생성하세요.
형식 규칙:
- passage 필드에 교수 + 학생2명 포스트를 넣으세요:
  "Dr. [교수 성]:\\n[교수 토론 질문 — 정확히 ${adw.prof}단어]\\n\\n[학생1 이름]:\\n[학생1 의견 — 정확히 ${adw.studentA}단어]\\n\\n[학생2 이름]:\\n[학생2 의견 — 정확히 ${adw.studentB}단어]"
- content 필드에는 아래 표준 형식을 정확히 따르세요:
  "Your professor is teaching a class on [수업 주제]. Write a post responding to the professor's question.\\n\\nIn your response, you should do the following:\\n• Express and support your opinion.\\n• Make a contribution to the discussion in your own words.\\n\\nAn effective response will contain at least ${adw.answer} words."
- answer 필드에 ${adw.answer}단어 이상의 모범 답안을 넣으세요
- explanation 필드는 반드시 다음 형식으로 작성하세요:
  "[채점 기준 텍스트]\\n\\n===번역===\\n\\n【지문 번역】\\nDr. [이름]:\\n[교수 질문 한글 번역]\\n\\n[학생1 이름]:\\n[학생1 의견 한글 번역]\\n\\n[학생2 이름]:\\n[학생2 의견 한글 번역]\\n\\n【모범 답안 번역】\\n[answer 한글 번역]"
- 교수 포스트는 수업 맥락 소개 + 명확한 토론 질문 포함
- 두 학생은 서로 다른 입장을 표명하며 간결한 근거 제시
- options는 null
- 난이도: ${diffDesc} ${topicNote}
- difficulty 값은 반드시 ${difficulty}를 사용하세요
- question_subtype은 반드시 "academic_discussion"으로 설정하세요
- category는 반드시 "writing"으로 설정하세요

반드시 다음 JSON 형식으로만 응답 (마크다운 코드블록 없이 순수 JSON):
{"questions":[{"content":"Your professor is teaching a class on business management. Write a post responding to the professor's question.\\n\\nIn your response, you should do the following:\\n• Express and support your opinion.\\n• Make a contribution to the discussion in your own words.\\n\\nAn effective response will contain at least 100 words.","passage":"Dr. Palmer:\\nFor the past few classes, we have been discussing the rise of remote work. Many companies adopted it during the pandemic and some have kept it. Others have required employees to return to the office. What are your thoughts? Do you think remote work will become the norm, or will most employees return to the office in the long run?\\n\\nAlex:\\nI think remote work will become more common. Studies show that employees are more productive at home because there are fewer distractions. Companies can also save money on office space, which benefits everyone.\\n\\nMia:\\nI disagree. I believe most people will return to the office because working in person makes collaboration and communication much easier. Building strong relationships with colleagues is harder when you are working remotely.","options":null,"answer":"I agree with Alex that remote work will become increasingly common. Research consistently shows that employees who work from home report higher productivity and job satisfaction. Without constant interruptions from colleagues, workers can focus more deeply on their tasks.\\n\\nWhile Mia raises a valid point about collaboration, technology has largely addressed this challenge. Video conferencing and project management tools allow teams to communicate effectively from anywhere. Many successful companies now operate entirely remotely with no loss in performance.\\n\\nUltimately, remote work offers employees a better work-life balance while allowing companies to reduce overhead costs. These advantages make it a compelling long-term solution for many industries.","explanation":"채점 기준: 명확한 의견 제시, 논리적 근거 2가지 이상, 두 학생 의견 중 하나 이상 참조, 100단어 이상, 학술 문체\\n\\n===번역===\\n\\n【지문 번역】\\nPalmer 교수:\\n지난 몇 수업 동안 우리는 원격 근무의 부상에 대해 논의했습니다. 많은 회사들이 팬데믹 중에 이를 채택했고 일부는 유지했습니다. 원격 근무가 표준이 될까요, 아니면 대부분의 직원들이 사무실로 돌아올까요?\\n\\nAlex:\\n저는 원격 근무가 더 일반화될 것이라고 생각합니다. 연구에 따르면 직원들이 집에서 더 생산적입니다.\\n\\nMia:\\n저는 반대합니다. 대부분의 사람들이 사무실로 돌아올 것이라고 생각합니다. 대면 협업이 더 효과적이기 때문입니다.\\n\\n【모범 답안 번역】\\n저는 원격 근무가 점점 더 일반화될 것이라는 Alex의 의견에 동의합니다. 연구에 따르면 재택근무 직원들이 더 높은 생산성을 보고합니다. 기술은 Mia가 제기한 협업 문제도 대부분 해결했습니다. 원격 근무는 직원들에게 더 나은 일과 생활의 균형을 제공합니다.","category":"writing","difficulty":${difficulty},"question_subtype":"academic_discussion","audio_script":null,"speaking_prompt":null}]}`,

    listen_and_repeat: `TOEFL 2026 AI-Scoring 기준 "Listen and Repeat" 세트를 ${n}개 생성하세요. 각 세트는 ${qpp}개의 문장으로 구성됩니다. 총 ${n * qpp}개의 문제 객체를 questions 배열에 담으세요.

[시나리오]
- 주로 대학 캠퍼스 생활 (도서관, 수강신청, 동아리, 스터디 그룹, 기숙사, 강의실 등)
- 간혹 공공기관 (은행, 우체국, 동사무소, 병원 등) 또는 직장 상황도 포함
- 세트가 여러 개라면 각 세트는 서로 다른 상황을 사용하세요

[문장 길이 — 세트 내 순서 기준]
- 1~2번째 문장: 6~8단어
- 3~5번째 문장: 9~11단어
- 6번째 이상 문장: 12~15단어
- 문법: 9단어 이상 문장에는 종속절(because, although, when, if, since 등) 또는 전치사구를 최소 1개 포함 (Chunking 평가 대상)
- 난이도: ${diffDesc} ${topicNote}

[필드 규칙]
- audio_script: TTS 변환용 순수 텍스트만 — 발음기호·마크업·슬래시·별표 절대 금지
- speaking_prompt = audio_script (완전 동일한 순수 텍스트)
- answer: 다음 3가지 음성 주석을 모두 포함한 채점 기준 버전
    1) 청킹 구간마다 " / " 삽입 (자연스러운 의미 단위로 분리)
    2) 1차 강세를 받는 단어를 **굵게** 표시 (문장당 3-5개)
    3) 특정 연음 현상 1가지를 [대괄호] 안에 표기 — 유형 중 하나 선택:
       Flap T (예: [Flap T: "butter" → /bʌɾər/])
       Elision (예: [Elision: "last night" → /læsnaɪt/])
       C-to-V Linking (예: [Linking: "turn_it" → /tɜrnɪt/])
       Assimilation (예: [Assim: "ten pounds" → /tem paʊndz/])
- explanation: 아래 두 섹션 포함
    【채점 기준】강세 단어 목록, 청킹 구간 수, 연음 규칙 명시 (예: Flap T 적용 단어, 억양 패턴)
    【해설】이 문장에서 페이싱과 억양이 중요한 이유 2-3문장
- content: "Listen and repeat the following sentence."
- passage: 세트 식별자 (예: "L&R Set 1: Library Research")
- difficulty: 반드시 ${difficulty}
- question_subtype: "listen_and_repeat"
- category: "speaking"

반드시 다음 JSON 형식으로만 응답 (마크다운 코드블록 없이 순수 JSON):
{"questions":[{"content":"Listen and repeat the following sentence.","passage":"L&R Set 1: Library","options":null,"answer":"The **library** / **closes** at **nine**.","explanation":"【채점 기준】1차 강세: library, closes, nine. 청킹 2구간. 연음: C-to-V Linking (closes_at → /kloʊzɪt/). 【해설】짧은 문장이지만 library의 3음절 강세(/ˈlaɪ.brər.i/)와 closes at의 연음 처리가 자연스러운 발화의 핵심입니다.","category":"speaking","difficulty":${difficulty},"question_subtype":"listen_and_repeat","audio_script":"The library closes at nine.","speaking_prompt":"The library closes at nine."},{"content":"Listen and repeat the following sentence.","passage":"L&R Set 1: Library","options":null,"answer":"**When** I **checked** out the **book** / the **librarian** reminded me / to **return** it on **time** [C-to-V Linking: \"return_it\" → /rɪˈtɜrnɪt/].","explanation":"【채점 기준】1차 강세: When, checked, book, librarian, return, time. 청킹 3구간. 연음: C-to-V Linking (return + it). 【해설】종속절(When I checked out...)과 주절이 구분되어 청킹이 핵심입니다. 포즈 없이 읽으면 의미 단위가 불명확해지고 AI 채점에서 Chunking 감점됩니다.","category":"speaking","difficulty":${difficulty},"question_subtype":"listen_and_repeat","audio_script":"When I checked out the book, the librarian reminded me to return it on time.","speaking_prompt":"When I checked out the book, the librarian reminded me to return it on time."}]}`,

    academic_passage: `TOEFL "Read an Academic Passage" 문제 세트 ${n}개를 생성하세요.
- 자연과학/역사/사회과학 학술 지문 ${n}개를 생성하고, 각 지문마다 ${qpp}개의 문제를 만드세요
- 총 ${n * qpp}개의 문제 객체를 questions 배열에 포함하세요
- 각 지문은 ${wc5}단어로 작성하세요
- 각 지문에 대한 ${qpp}개 문제 중 첫 번째 문제의 passage 필드에만 지문 전체를 넣으세요
- 같은 지문의 나머지 문제들은 passage 필드에 "__SAME__" 라고만 입력하세요 (API가 자동으로 채웁니다)
- 각 지문에 대해 다양한 질문 유형: 사실확인(factual), 추론(inference), 어휘(vocabulary), 목적(purpose), 문장삽입(insert) 등
- options는 반드시 4개를 포함해야 합니다
- answer는 정답 번호를 문자열로 (예: "2")
- 난이도: ${diffDesc} ${topicNote}
- difficulty 값은 반드시 ${difficulty}를 사용하세요
- 모든 항목의 question_subtype은 반드시 "academic_passage"로 설정하세요
- 모든 항목의 category는 반드시 "reading"으로 설정하세요

반드시 다음 JSON 형식으로만 응답 (마크다운 코드블록 없이 순수 JSON):
{"questions":[{"content":"According to the passage, which of the following is true?","passage":"[200-300 word academic passage here — only in the FIRST question of each set]","options":[{"num":1,"text":"..."},{"num":2,"text":"..."},{"num":3,"text":"..."},{"num":4,"text":"..."}],"answer":"2","explanation":"해설...","category":"reading","difficulty":${difficulty},"question_subtype":"academic_passage","audio_script":null,"speaking_prompt":null},{"content":"두 번째 질문 (inference/vocabulary/etc.)...","passage":"__SAME__","options":[{"num":1,"text":"..."},{"num":2,"text":"..."},{"num":3,"text":"..."},{"num":4,"text":"..."}],"answer":"3","explanation":"해설...","category":"reading","difficulty":${difficulty},"question_subtype":"academic_passage","audio_script":null,"speaking_prompt":null}]}`,

    take_an_interview: `TOEFL "Take an Interview" 인터뷰 세트를 ${n}개 생성하세요. 각 세트는 ${qpp}개의 연속 질문으로 구성됩니다. 총 ${n * qpp}개의 문제 객체를 questions 배열에 담으세요.
- 각 세트는 서로 다른 주제(예: 공부 방법, 여행, 기술, 환경, 일 vs 여가 등)를 사용하세요
- 같은 세트 안의 질문들은 하나의 주제에서 자연스럽게 이어지는 인터뷰 흐름으로 구성하세요 (첫 질문 → 심화 → 마무리)
- 각 세트의 마지막 질문은 반드시 동의/의견 확인형으로 끝내세요 (예: "Do you agree that...?", "Would you say that...?")
- 같은 세트에 속한 모든 문제의 passage 필드에 동일한 인터뷰 소개 지문을 넣으세요 (2-3문장 영어). TOEFL Speaking 형식의 인터뷰 시나리오 — 누가 누구에게 인터뷰하는지, 어떤 맥락인지 설명하는 도입 문장. 예: "You have agreed to participate in a research study about technology. A researcher will ask you several questions about your experiences and opinions."
- content 필드에 영어 질문과 한국어 번역을 함께 넣으세요
- speaking_prompt 필드 = content의 영어 질문 부분
- answer 필드에 모범 답안을 넣으세요 (명확한 입장, 2-3가지 이유, 구체적 예시, ~45초 분량)
- options는 null로 설정하세요
- 준비 시간 15초, 답변 시간 45초 상정
- 난이도: ${diffDesc} ${topicNote}
- difficulty 값은 반드시 ${difficulty}를 사용하세요
- question_subtype은 반드시 "take_an_interview"로 설정하세요
- category는 반드시 "speaking"으로 설정하세요

반드시 다음 JSON 형식으로만 응답 (마크다운 코드블록 없이 순수 JSON):
{"questions":[{"content":"Some people prefer studying alone, while others prefer studying in groups. Which do you prefer and why?\\n(혼자 공부와 그룹 공부 중 어떤 것을 선호하나요?)","passage":"You have agreed to take part in a university survey about student learning habits. A researcher will ask you a series of questions about how you study and what you think about academic success.","options":null,"answer":"I prefer studying alone because I can focus better. First, I can set my own pace. For example, last semester I mastered calculus by studying alone two hours daily. Second, solo study builds self-discipline essential for academic success.","explanation":"채점 포인트: 명확한 입장, 2가지 이유, 구체적 예시, 45초 분량","category":"speaking","difficulty":${difficulty},"question_subtype":"take_an_interview","audio_script":null,"speaking_prompt":"Some people prefer studying alone, while others prefer studying in groups. Which do you prefer and why?"},{"content":"Do you agree that developing good study habits early in life is more important than natural intelligence?\\n(어릴 때 좋은 학습 습관을 기르는 것이 타고난 지능보다 중요하다고 생각하나요?)","passage":"You have agreed to take part in a university survey about student learning habits. A researcher will ask you a series of questions about how you study and what you think about academic success.","options":null,"answer":"Yes, I strongly agree. Habits are actively developable, while intelligence is largely fixed. Many successful people attribute achievements to consistent effort rather than innate talent. Regular review and active recall can overcome gaps in natural ability.","explanation":"채점 포인트: 동의/반대 명확히, 근거 2가지, 45초 분량","category":"speaking","difficulty":${difficulty},"question_subtype":"take_an_interview","audio_script":null,"speaking_prompt":"Do you agree that developing good study habits early in life is more important than natural intelligence?"}]}`,
  }

  // fallback: old category-level prompts for subtypes not listed above (e.g. academic passage subtypes)
  const categoryFallbacks: Record<string, string> = {
    reading: `TOEFL iBT Reading 학술 지문 문제를 ${n}개 생성하세요.
- 700단어+ 학술 지문 (한 지문에 여러 문제)
- 유형: 사실확인, 부정사실, 추론, 어휘, 문장삽입, 요약 등
- 4지선다, 난이도: ${diffDesc} ${topicNote}
- difficulty 값은 반드시 ${difficulty}를 사용하세요

반드시 다음 JSON 형식으로만 응답 (마크다운 코드블록 없이 순수 JSON):
{"questions":[{"content":"문제","passage":"지문","options":[{"num":1,"text":"..."},{"num":2,"text":"..."},{"num":3,"text":"..."},{"num":4,"text":"..."}],"answer":"1","explanation":"해설","category":"reading","difficulty":${difficulty},"question_subtype":"${subtype || 'factual'}","audio_script":null,"speaking_prompt":null}]}`,

    listening: `TOEFL iBT Listening 문제를 ${n}개 생성하세요.
- 강의 또는 대화 스크립트
- 4지선다, 난이도: ${diffDesc} ${topicNote}
- difficulty 값은 반드시 ${difficulty}를 사용하세요

반드시 다음 JSON 형식으로만 응답 (마크다운 코드블록 없이 순수 JSON):
{"questions":[{"content":"문제","passage":null,"options":[{"num":1,"text":"..."},{"num":2,"text":"..."},{"num":3,"text":"..."},{"num":4,"text":"..."}],"answer":"2","explanation":"해설","category":"listening","difficulty":${difficulty},"question_subtype":"${subtype || 'detail'}","audio_script":"스크립트...","speaking_prompt":null}]}`,
  }

  const basePrompt = subtypePrompts[subtype] ?? categoryFallbacks[category] ?? subtypePrompts[Object.keys(subtypePrompts)[0]]
  return basePrompt + passageContextNote
}

export async function POST(req: NextRequest) {
  // getSession() — 쿠키에서 읽기만 (네트워크 없음, 타임아웃 없음)
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = getAnthropicKey()
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY가 서버에 설정되지 않았습니다.' }, { status: 500 })

  const anthropic = new Anthropic({ apiKey })

  const { category, subtype, difficulty, count, topic, questionsPerPassage, wordCount, passageContext, acadDiscWords } = await req.json()

  const topicValue = topic ?? ''
  const prompt = buildPrompt(category, subtype ?? '', difficulty, count, topicValue, questionsPerPassage ?? 1, wordCount ?? 0, passageContext ?? '', acadDiscWords ?? null)
    + `\n\n【필수 추가 필드】위 JSON의 각 문제 객체에 반드시 다음 두 필드를 포함하세요:
- "summary": 지문·음성·시나리오를 한국어로 1-2문장 요약 (예: "환경오염이 기후변화에 미치는 영향을 논의하는 학술 지문", "도서관 연장 운영에 관한 두 학생의 캠퍼스 대화")
- "subcategory": 주제 키워드 1-2개 (예: "환경", "IT", "경제", "캠퍼스생활", "과학"${topicValue ? ` — 입력된 주제 "${topicValue}"를 우선 사용` : ''})
- "vocab_words": content(문제) 또는 answer(정답/모범답안)에 실제로 등장하는 단어 중 학습 가치가 높은 것을 선택하여 JSON 배열로
  ▸ choose_response / listen_and_repeat / take_an_interview → 1-2개 (짧은 문장이므로 최대 2개)
  ▸ 그 외 모든 유형 → 최소 5개 이상 (숙어·구동사 포함 가능)
  ▸ passage(지문)에만 있고 content/answer에 없는 단어는 제외
  ▸ 문법·작문 순수 유형은 null 허용
  형식: [{"word":"어휘","pos":"품사(n./v./adj./adv./phrase 등)","def":"한국어 뜻 또는 영어 정의","example":"해당 문제/정답에서 그 단어가 쓰인 문장 그대로"}]
  예시: [{"word":"innate","pos":"adj.","def":"타고난, 선천적인","example":"innate talent is largely fixed"},{"word":"attribute","pos":"v.","def":"~의 덕분으로 돌리다","example":"attribute their achievements to consistent effort"}]`

  let message
  try {
    message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }],
    })
  } catch (apiErr: unknown) {
    const msg = apiErr instanceof Error ? apiErr.message : String(apiErr)
    return NextResponse.json({ error: `AI API 오류: ${msg}` }, { status: 502 })
  }

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  // Try closed code block first, then open/unclosed block, then bare JSON object
  const jsonMatch =
    text.match(/```json\s*([\s\S]*?)\s*```/) ||
    text.match(/```json\s*([\s\S]+)/) ||
    text.match(/({[\s\S]*})/)
  const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : text

  let parsed: { questions: { passage?: string | null; audio_script?: string | null }[] }
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    return NextResponse.json({ error: 'AI 응답 파싱 실패', raw: text.slice(0, 500) }, { status: 500 })
  }

  // __SAME__ 처리: 같은 세트 내 첫 번째 값을 이후 문제들에 복사
  if (Array.isArray(parsed.questions)) {
    let lastPassage: string | null = null
    let lastAudioScript: string | null = null
    for (const q of parsed.questions) {
      if (q.passage && q.passage !== '__SAME__') {
        lastPassage = q.passage
      } else if (q.passage === '__SAME__' && lastPassage) {
        q.passage = lastPassage
      }
      if (q.audio_script && q.audio_script !== '__SAME__') {
        lastAudioScript = q.audio_script
      } else if (q.audio_script === '__SAME__' && lastAudioScript) {
        q.audio_script = lastAudioScript
      }
    }
  }

  return NextResponse.json(parsed)
}
