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
    complete_the_words: `TOEFL "Complete the Words" (단락형 빈칸) 문제를 ${n}개 생성하세요.
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

    sentence_completion: `TOEFL "Sentence Completion" (문장 세트 빈칸) 문제 1개를 생성하세요.
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
- 이메일 형식: "From: name@email.com\\nTo: name@email.com\\nDate: [날짜]\\nSubject: [제목]\\n\\n[본문]"
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
- options: exactly 4 choices; answer: correct option number as string (e.g. "1")
- Difficulty: ${diffDesc} ${topicNote}
- difficulty value must be ${difficulty}
- All question_subtype: "conversation", category: "listening"

Respond with pure JSON only (no markdown):
{"questions":[{"content":"What is the conversation mainly about?","passage":null,"options":[{"num":1,"text":"..."},{"num":2,"text":"..."},{"num":3,"text":"..."},{"num":4,"text":"..."}],"answer":"1","explanation":"해설...","category":"listening","difficulty":${difficulty},"question_subtype":"conversation","audio_script":"A: Excuse me, Professor Johnson. Do you have a moment?\\nB: Sure, come on in. What can I help you with?\\nA: [dialogue continues in A:/B: format, ${wc7} words total]","speaking_prompt":null},{"content":"두 번째 질문 (같은 대화)...","passage":null,"options":[{"num":1,"text":"..."},{"num":2,"text":"..."},{"num":3,"text":"..."},{"num":4,"text":"..."}],"answer":"2","explanation":"해설...","category":"listening","difficulty":${difficulty},"question_subtype":"conversation","audio_script":"A: Excuse me, Professor Johnson. Do you have a moment?\\nB: Sure, come on in. What can I help you with?\\nA: [same full dialogue]","speaking_prompt":null}]}`,

    academic_talk: `Role: You are an expert TOEFL iBT listening test developer.
Task: Create ${n} academic lecture listening sets (${n} × ${qpp} questions = exactly ${n * qpp} question objects).
Constraints:
- Each lecture script is exactly ${wc8} words (professor's monologue on an academic topic)
- Scripts are written in natural spoken English with "Today we're going to talk about..." style opening
- Each set shares the same audio_script across its ${qpp} questions
- options: exactly 4 choices; answer: correct option number as string (e.g. "3")
- Difficulty: ${diffDesc} ${topicNote}
- difficulty value must be ${difficulty}
- All question_subtype: "academic_talk", category: "listening"

Respond with pure JSON only (no markdown):
{"questions":[{"content":"What is the main topic of the lecture?","passage":null,"options":[{"num":1,"text":"..."},{"num":2,"text":"..."},{"num":3,"text":"..."},{"num":4,"text":"..."}],"answer":"3","explanation":"해설...","category":"listening","difficulty":${difficulty},"question_subtype":"academic_talk","audio_script":"Today we're going to talk about... [full lecture script, ${wc8} words]","speaking_prompt":null},{"content":"두 번째 질문 (같은 강의)...","passage":null,"options":[{"num":1,"text":"..."},{"num":2,"text":"..."},{"num":3,"text":"..."},{"num":4,"text":"..."}],"answer":"1","explanation":"해설...","category":"listening","difficulty":${difficulty},"question_subtype":"academic_talk","audio_script":"Today we're going to talk about... [same full lecture script]","speaking_prompt":null}]}`,

    campus_announcement: `Role: You are an expert TOEFL iBT listening test developer.
Task: Create ${n} campus announcement listening sets (${n} × ${qpp} questions = exactly ${n * qpp} question objects).
Constraints:
- Each announcement script is exactly ${wc8} words (campus official, staff, or student making a campus-life announcement — e.g. events, facilities, policies, deadlines)
- Scripts are written in natural spoken English as a single speaker monologue
- Each set shares the same audio_script across its ${qpp} questions
- options: exactly 4 choices; answer: correct option number as string (e.g. "2")
- Difficulty: ${diffDesc} ${topicNote}
- difficulty value must be ${difficulty}
- All question_subtype: "campus_announcement", category: "listening"

Respond with pure JSON only (no markdown):
{"questions":[{"content":"What is the announcement mainly about?","passage":null,"options":[{"num":1,"text":"..."},{"num":2,"text":"..."},{"num":3,"text":"..."},{"num":4,"text":"..."}],"answer":"2","explanation":"해설...","category":"listening","difficulty":${difficulty},"question_subtype":"campus_announcement","audio_script":"Good afternoon, everyone. I'd like to make an announcement about... [full announcement script, ${wc8} words]","speaking_prompt":null},{"content":"두 번째 질문 (같은 공지)...","passage":null,"options":[{"num":1,"text":"..."},{"num":2,"text":"..."},{"num":3,"text":"..."},{"num":4,"text":"..."}],"answer":"3","explanation":"해설...","category":"listening","difficulty":${difficulty},"question_subtype":"campus_announcement","audio_script":"Good afternoon, everyone. I'd like to make an announcement about... [same full script]","speaking_prompt":null}]}`,

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
- content 필드에 특정 상황과 반드시 포함할 조건 3가지를 제시하세요
- answer 필드에 ${wc10}단어 이상의 모범 이메일 답안을 넣으세요
- options는 null로 설정하세요
- 난이도: ${diffDesc} ${topicNote}
- difficulty 값은 반드시 ${difficulty}를 사용하세요
- question_subtype은 반드시 "email_writing"으로 설정하세요
- category는 반드시 "writing"으로 설정하세요

반드시 다음 JSON 형식으로만 응답 (마크다운 코드블록 없이 순수 JSON):
{"questions":[{"content":"You recently visited a restaurant and had a bad experience. Write an email to the manager.\\n\\nYour email must include:\\n• Describe what went wrong during your visit\\n• Explain how this experience affected you\\n• Suggest what the restaurant should do to improve","passage":null,"options":null,"answer":"Dear Manager,\\n\\nI am writing to express my disappointment regarding my recent visit to your restaurant on March 10th. [150+ word model email continues with all 3 conditions addressed]\\n\\nSincerely,\\n[Name]","explanation":"채점 기준: 조건 3가지 충족, 격식체 이메일 형식, 논리적 구성, 150단어 이상","category":"writing","difficulty":${difficulty},"question_subtype":"email_writing","audio_script":null,"speaking_prompt":null}]}`,

    academic_discussion: `TOEFL "Write for an Academic Discussion" 문제를 ${n}개 생성하세요.
형식 규칙:
- passage 필드에 교수 + 학생2명 포스트를 넣으세요:
  "Dr. [교수 성]:\\n[교수 토론 질문 — 정확히 ${adw.prof}단어]\\n\\n[학생1 이름]:\\n[학생1 의견 — 정확히 ${adw.studentA}단어]\\n\\n[학생2 이름]:\\n[학생2 의견 — 정확히 ${adw.studentB}단어]"
- content 필드에는 학생 지시문만 넣으세요:
  "Write a post responding to the professor's question. Express and support your opinion. Make a contribution to the discussion in your own words. An effective response will contain at least ${adw.answer} words."
- answer 필드에 ${adw.answer}단어 이상의 모범 답안을 넣으세요
- 교수 포스트는 수업 맥락 소개 + 명확한 토론 질문 포함
- 두 학생은 서로 다른 입장을 표명하며 간결한 근거 제시
- options는 null
- 난이도: ${diffDesc} ${topicNote}
- difficulty 값은 반드시 ${difficulty}를 사용하세요
- question_subtype은 반드시 "academic_discussion"으로 설정하세요
- category는 반드시 "writing"으로 설정하세요

반드시 다음 JSON 형식으로만 응답 (마크다운 코드블록 없이 순수 JSON):
{"questions":[{"content":"Write a post responding to the professor's question. Express and support your opinion. Make a contribution to the discussion in your own words. An effective response will contain at least 100 words.","passage":"Dr. Palmer:\\nFor the past few classes, we have been discussing the rise of remote work. Many companies adopted it during the pandemic and some have kept it. Others have required employees to return to the office. What are your thoughts? Do you think remote work will become the norm, or will most employees return to the office in the long run?\\n\\nAlex:\\nI think remote work will become more common. Studies show that employees are more productive at home because there are fewer distractions. Companies can also save money on office space, which benefits everyone.\\n\\nMia:\\nI disagree. I believe most people will return to the office because working in person makes collaboration and communication much easier. Building strong relationships with colleagues is harder when you are working remotely.","options":null,"answer":"I agree with Alex that remote work will become increasingly common. Research consistently shows that employees who work from home report higher productivity and job satisfaction. Without constant interruptions from colleagues, workers can focus more deeply on their tasks.\\n\\nWhile Mia raises a valid point about collaboration, technology has largely addressed this challenge. Video conferencing and project management tools allow teams to communicate effectively from anywhere. Many successful companies now operate entirely remotely with no loss in performance.\\n\\nUltimately, remote work offers employees a better work-life balance while allowing companies to reduce overhead costs. These advantages make it a compelling long-term solution for many industries.","explanation":"채점 기준: 명확한 의견 제시, 논리적 근거 2가지 이상, 두 학생 의견 중 하나 이상 참조, 100단어 이상, 학술 문체","category":"writing","difficulty":${difficulty},"question_subtype":"academic_discussion","audio_script":null,"speaking_prompt":null}]}`,

    listen_and_repeat: `TOEFL "Listen and Repeat" 세트를 ${n}개 생성하세요. 각 세트는 ${qpp}개의 문장으로 구성됩니다. 총 ${n * qpp}개의 문제 객체를 questions 배열에 담으세요.
- 같은 세트 안의 문장들은 같은 주제/상황에서 점점 길어지도록 구성하세요 (단계적 난이도 상승)
  예) 세트 내 1번: 짧고 간단 (5-7단어), 2번: 약간 길어짐 (8-10단어), 3번: 더 길어짐 (11-14단어)
- 세트가 여러 개라면 각 세트는 서로 다른 주제/상황을 사용하세요
- 같은 세트에 속한 문제들은 passage 필드에 동일한 세트 식별자를 넣으세요 (예: "L&R Set 1: Campus Life") — 이 값으로 묶어 저장됩니다
- speaking_prompt 필드 = audio_script 필드 = 반복할 문장 (동일한 값)
- answer 필드 = 반복할 문장 (speaking_prompt와 동일)
- content 필드에는 지시문을 넣으세요 (예: "Listen and repeat the following sentence.")
- 난이도: ${diffDesc} ${topicNote}
- difficulty 값은 반드시 ${difficulty}를 사용하세요
- question_subtype은 반드시 "listen_and_repeat"으로 설정하세요
- category는 반드시 "speaking"으로 설정하세요

반드시 다음 JSON 형식으로만 응답 (마크다운 코드블록 없이 순수 JSON):
{"questions":[{"content":"Listen and repeat the following sentence.","passage":"L&R Set 1: Campus Life","options":null,"answer":"She studies.","explanation":"발음 포인트: /ʃ/ 마찰음","category":"speaking","difficulty":${difficulty},"question_subtype":"listen_and_repeat","audio_script":"She studies.","speaking_prompt":"She studies."},{"content":"Listen and repeat the following sentence.","passage":"L&R Set 1: Campus Life","options":null,"answer":"She studies at the library every afternoon.","explanation":"발음 포인트: /ˈlaɪ.brər.i/, 리듬 패턴","category":"speaking","difficulty":${difficulty},"question_subtype":"listen_and_repeat","audio_script":"She studies at the library every afternoon.","speaking_prompt":"She studies at the library every afternoon."}]}`,

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
- 같은 세트에 속한 문제들은 passage 필드에 동일한 세트 식별자를 넣으세요 (예: "Interview Set 1: Study Habits") — 이 값으로 묶어 저장됩니다
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
{"questions":[{"content":"Some people prefer studying alone, while others prefer studying in groups. Which do you prefer and why?\\n(혼자 공부와 그룹 공부 중 어떤 것을 선호하나요?)","passage":"Interview Set 1: Study Habits","options":null,"answer":"I prefer studying alone because I can focus better. First, I can set my own pace. For example, last semester I mastered calculus by studying alone two hours daily. Second, solo study builds self-discipline essential for academic success.","explanation":"채점 포인트: 명확한 입장, 2가지 이유, 구체적 예시, 45초 분량","category":"speaking","difficulty":${difficulty},"question_subtype":"take_an_interview","audio_script":null,"speaking_prompt":"Some people prefer studying alone, while others prefer studying in groups. Which do you prefer and why?"},{"content":"Do you agree that developing good study habits early in life is more important than natural intelligence?\\n(어릴 때 좋은 학습 습관을 기르는 것이 타고난 지능보다 중요하다고 생각하나요?)","passage":"Interview Set 1: Study Habits","options":null,"answer":"Yes, I strongly agree. Habits are actively developable, while intelligence is largely fixed. Many successful people attribute achievements to consistent effort rather than innate talent. Regular review and active recall can overcome gaps in natural ability.","explanation":"채점 포인트: 동의/반대 명확히, 근거 2가지, 45초 분량","category":"speaking","difficulty":${difficulty},"question_subtype":"take_an_interview","audio_script":null,"speaking_prompt":"Do you agree that developing good study habits early in life is more important than natural intelligence?"}]}`,
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
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    })
  } catch (apiErr: unknown) {
    const msg = apiErr instanceof Error ? apiErr.message : String(apiErr)
    return NextResponse.json({ error: `AI API 오류: ${msg}` }, { status: 502 })
  }

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/({[\s\S]*})/)
  const jsonStr = jsonMatch ? jsonMatch[1] ?? jsonMatch[0] : text

  let parsed: { questions: { passage?: string | null }[] }
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    return NextResponse.json({ error: 'AI 응답 파싱 실패', raw: text.slice(0, 500) }, { status: 500 })
  }

  // __SAME__ 처리: 같은 세트 내 첫 번째 지문을 이후 문제들에 복사
  if (Array.isArray(parsed.questions)) {
    let lastPassage: string | null = null
    for (const q of parsed.questions) {
      if (q.passage && q.passage !== '__SAME__') {
        lastPassage = q.passage
      } else if (q.passage === '__SAME__' && lastPassage) {
        q.passage = lastPassage
      }
    }
  }

  return NextResponse.json(parsed)
}
