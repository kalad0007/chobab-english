-- =============================================
-- 초밥샘의 영어공부 - Supabase Schema
-- =============================================

-- 확장 프로그램
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. 사용자 프로필 (Supabase Auth 연동)
-- =============================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auth 회원가입 시 자동으로 프로필 생성
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- 2. 반 (Class)
-- =============================================
CREATE TABLE classes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  grade INTEGER CHECK (grade BETWEEN 1 AND 3),  -- 학년
  invite_code TEXT UNIQUE NOT NULL DEFAULT substring(md5(random()::text), 1, 8),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 반-학생 매핑
CREATE TABLE class_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, student_id)
);

-- =============================================
-- 3. 문제은행
-- =============================================
CREATE TABLE questions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

  -- 문제 내용
  type TEXT NOT NULL CHECK (type IN ('multiple_choice', 'short_answer', 'essay')),
  content TEXT NOT NULL,           -- 문제 본문
  passage TEXT,                    -- 지문 (독해용)
  options JSONB,                   -- 객관식 보기 [{num: 1, text: "..."}]
  answer TEXT NOT NULL,            -- 정답
  explanation TEXT,                -- 해설

  -- 분류
  category TEXT NOT NULL CHECK (category IN ('grammar', 'vocabulary', 'reading', 'writing', 'listening', 'speaking', 'cloze', 'ordering')),
  subcategory TEXT,                -- 세부 유형 (tense, modal, synonym 등)
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  source TEXT DEFAULT 'teacher' CHECK (source IN ('teacher', 'ai_generated', 'ksat')),

  -- TOEFL 세부 유형
  question_subtype TEXT,           -- reading/listening/speaking/writing 세부 유형
  preparation_time INTEGER,        -- Speaking 준비시간(초)
  response_time INTEGER,           -- Speaking 응답시간(초)
  word_limit INTEGER,              -- Writing 최소 단어수
  task_number INTEGER,             -- Speaking Task 1-4, Writing Task 1-2
  time_limit INTEGER,              -- 문제당 제한시간(초)

  -- 리스닝/스피킹 미디어
  audio_url TEXT,                  -- 오디오 파일 URL
  audio_script TEXT,               -- 오디오 스크립트 (리스닝)
  audio_play_limit INTEGER,        -- 재생 횟수 제한
  speaking_prompt TEXT,            -- 스피킹 과제 지문

  -- 세트/그룹핑
  passage_id TEXT,                 -- 같은 지문 문제 그룹핑 (Reading)
  audio_id TEXT,                   -- 같은 오디오 문제 그룹핑 (Listening)
  passage_group_id UUID,           -- 지문 세트 그룹 ID

  -- 이메일 문제 전용
  email_to TEXT,
  email_subject TEXT,

  -- 검색/분류용
  summary TEXT,                    -- 지문/음성 내용 요약
  vocab_words JSONB,               -- 핵심단어 [{word, pos, def, example}]

  -- 통계 (캐시)
  attempt_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 4. 시험
-- =============================================
CREATE TABLE exams (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,

  title TEXT NOT NULL,
  description TEXT,
  time_limit INTEGER,              -- 분 단위, NULL이면 무제한
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  show_result_immediately BOOLEAN DEFAULT FALSE,  -- 제출 즉시 결과 공개 여부
  total_points INTEGER DEFAULT 100,
  exam_type TEXT DEFAULT 'practice' CHECK (exam_type IN ('full_test', 'section_test', 'practice')),
  sections TEXT[],                 -- 포함 섹션 배열 ['reading','listening','writing','speaking']
  max_band_ceiling NUMERIC(3,1) DEFAULT 6.0,  -- 밴드 상한선 (기본 6.0, 최대 9.0)

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 시험-문제 매핑
CREATE TABLE exam_questions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
  order_num INTEGER NOT NULL,
  points INTEGER DEFAULT 5,
  UNIQUE(exam_id, question_id),
  UNIQUE(exam_id, order_num)
);

-- =============================================
-- 5. 학생 답안 제출
-- =============================================
CREATE TABLE submissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  deployment_id UUID,              -- exam_deployments 참조 (옵션)

  score INTEGER,
  total_points INTEGER,
  percentage NUMERIC(5,2),
  -- TOEFL 밴드 점수 (섹션별 + 통합)
  overall_band NUMERIC(3,1),
  reading_band NUMERIC(3,1),
  listening_band NUMERIC(3,1),
  writing_band NUMERIC(3,1),
  speaking_band NUMERIC(3,1),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded')),

  UNIQUE(exam_id, student_id)
);

-- 문항별 학생 답안
CREATE TABLE submission_answers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
  student_answer TEXT,
  is_correct BOOLEAN,
  score INTEGER DEFAULT 0,
  teacher_feedback TEXT,           -- 서술형 피드백
  rubric_scores JSONB,             -- 루브릭 채점 결과 {task_achievement, coherence, ...}
  UNIQUE(submission_id, question_id)
);

-- =============================================
-- 6. 오답 재학습 큐
-- =============================================
CREATE TABLE wrong_answer_queue (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  original_question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
  generated_question_id UUID REFERENCES questions(id) ON DELETE SET NULL,  -- AI가 생성한 유사 문제

  retry_count INTEGER DEFAULT 0,
  next_review_at TIMESTAMPTZ DEFAULT NOW(),   -- Spaced Repetition 다음 복습일
  mastered BOOLEAN DEFAULT FALSE,
  last_attempt_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, original_question_id)
);

-- =============================================
-- 7. 학생별 영역 통계 (누적)
-- =============================================
CREATE TABLE student_skill_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('grammar', 'vocabulary', 'reading', 'writing', 'cloze', 'ordering')),

  total_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  accuracy NUMERIC(5,2) DEFAULT 0,

  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, category)
);

-- =============================================
-- 8. 학습 콘텐츠
-- =============================================
CREATE TABLE learning_contents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,

  title TEXT NOT NULL,
  content TEXT NOT NULL,           -- Markdown 형식
  category TEXT,
  is_published BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 9. 학생 XP / 게임화
-- =============================================
CREATE TABLE student_gamification (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,

  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  streak_days INTEGER DEFAULT 0,
  last_activity_date DATE,
  total_questions_solved INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- RLS (Row Level Security) 정책
-- =============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE wrong_answer_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_skill_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_gamification ENABLE ROW LEVEL SECURITY;

-- profiles: 본인만 수정, 선생님은 학생 정보 조회 가능
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- classes: 선생님만 생성/수정, 누구나 조회
CREATE POLICY "classes_select" ON classes FOR SELECT USING (true);
CREATE POLICY "classes_insert" ON classes FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "classes_update" ON classes FOR UPDATE USING (auth.uid() = teacher_id);
CREATE POLICY "classes_delete" ON classes FOR DELETE USING (auth.uid() = teacher_id);

-- class_members: 학생 본인 or 해당 반 선생님
CREATE POLICY "class_members_select" ON class_members FOR SELECT USING (true);
CREATE POLICY "class_members_insert" ON class_members FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "class_members_delete" ON class_members FOR DELETE USING (auth.uid() = student_id);

-- questions: 선생님만 CRUD, 학생은 시험에 포함된 것만 조회
CREATE POLICY "questions_select" ON questions FOR SELECT USING (
  auth.uid() = teacher_id OR
  EXISTS (
    SELECT 1 FROM exam_questions eq
    JOIN exams e ON eq.exam_id = e.id
    JOIN submissions s ON s.exam_id = e.id
    WHERE eq.question_id = questions.id AND s.student_id = auth.uid()
  )
);
CREATE POLICY "questions_insert" ON questions FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "questions_update" ON questions FOR UPDATE USING (auth.uid() = teacher_id);
CREATE POLICY "questions_delete" ON questions FOR DELETE USING (auth.uid() = teacher_id);

-- exams
CREATE POLICY "exams_select" ON exams FOR SELECT USING (
  auth.uid() = teacher_id OR
  EXISTS (
    SELECT 1 FROM class_members cm WHERE cm.class_id = exams.class_id AND cm.student_id = auth.uid()
  )
);
CREATE POLICY "exams_insert" ON exams FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "exams_update" ON exams FOR UPDATE USING (auth.uid() = teacher_id);
CREATE POLICY "exams_delete" ON exams FOR DELETE USING (auth.uid() = teacher_id);

-- submissions: 학생 본인 or 해당 시험 선생님
CREATE POLICY "submissions_select" ON submissions FOR SELECT USING (
  auth.uid() = student_id OR
  EXISTS (SELECT 1 FROM exams e WHERE e.id = submissions.exam_id AND e.teacher_id = auth.uid())
);
CREATE POLICY "submissions_insert" ON submissions FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "submissions_update" ON submissions FOR UPDATE USING (
  auth.uid() = student_id OR
  EXISTS (SELECT 1 FROM exams e WHERE e.id = submissions.exam_id AND e.teacher_id = auth.uid())
);

-- submission_answers
CREATE POLICY "submission_answers_select" ON submission_answers FOR SELECT USING (
  EXISTS (SELECT 1 FROM submissions s WHERE s.id = submission_answers.submission_id AND s.student_id = auth.uid()) OR
  EXISTS (
    SELECT 1 FROM submissions s JOIN exams e ON s.exam_id = e.id
    WHERE s.id = submission_answers.submission_id AND e.teacher_id = auth.uid()
  )
);
CREATE POLICY "submission_answers_insert" ON submission_answers FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM submissions s WHERE s.id = submission_answers.submission_id AND s.student_id = auth.uid())
);
CREATE POLICY "submission_answers_update" ON submission_answers FOR UPDATE USING (
  EXISTS (SELECT 1 FROM submissions s WHERE s.id = submission_answers.submission_id AND s.student_id = auth.uid()) OR
  EXISTS (
    SELECT 1 FROM submissions s JOIN exams e ON s.exam_id = e.id
    WHERE s.id = submission_answers.submission_id AND e.teacher_id = auth.uid()
  )
);

-- wrong_answer_queue: 학생 본인 + 해당 학생 담당 선생님
CREATE POLICY "waq_select" ON wrong_answer_queue FOR SELECT USING (
  auth.uid() = student_id OR
  EXISTS (
    SELECT 1 FROM class_members cm
    JOIN classes c ON cm.class_id = c.id
    WHERE cm.student_id = wrong_answer_queue.student_id AND c.teacher_id = auth.uid()
  )
);
CREATE POLICY "waq_insert" ON wrong_answer_queue FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "waq_update" ON wrong_answer_queue FOR UPDATE USING (auth.uid() = student_id);

-- student_skill_stats
CREATE POLICY "stats_select" ON student_skill_stats FOR SELECT USING (
  auth.uid() = student_id OR
  EXISTS (
    SELECT 1 FROM class_members cm
    JOIN classes c ON cm.class_id = c.id
    WHERE cm.student_id = student_skill_stats.student_id AND c.teacher_id = auth.uid()
  )
);
CREATE POLICY "stats_all" ON student_skill_stats FOR ALL USING (auth.uid() = student_id);

-- learning_contents
CREATE POLICY "lc_select" ON learning_contents FOR SELECT USING (
  auth.uid() = teacher_id OR is_published = true
);
CREATE POLICY "lc_insert" ON learning_contents FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "lc_update" ON learning_contents FOR UPDATE USING (auth.uid() = teacher_id);
CREATE POLICY "lc_delete" ON learning_contents FOR DELETE USING (auth.uid() = teacher_id);

-- gamification
CREATE POLICY "gamif_select" ON student_gamification FOR SELECT USING (true);
CREATE POLICY "gamif_all" ON student_gamification FOR ALL USING (auth.uid() = student_id);

-- =============================================
-- 유용한 함수들
-- =============================================

-- 학생 스킬 통계 업데이트
CREATE OR REPLACE FUNCTION update_student_skill_stats(
  p_student_id UUID,
  p_category TEXT,
  p_is_correct BOOLEAN
) RETURNS VOID AS $$
BEGIN
  INSERT INTO student_skill_stats (student_id, category, total_count, correct_count, accuracy)
  VALUES (p_student_id, p_category, 1, CASE WHEN p_is_correct THEN 1 ELSE 0 END, CASE WHEN p_is_correct THEN 100 ELSE 0 END)
  ON CONFLICT (student_id, category) DO UPDATE SET
    total_count = student_skill_stats.total_count + 1,
    correct_count = student_skill_stats.correct_count + CASE WHEN p_is_correct THEN 1 ELSE 0 END,
    accuracy = ROUND(
      (student_skill_stats.correct_count + CASE WHEN p_is_correct THEN 1 ELSE 0 END)::NUMERIC
      / (student_skill_stats.total_count + 1) * 100, 2
    ),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Spaced Repetition 다음 복습일 계산 (SM-2 단순화 버전)
CREATE OR REPLACE FUNCTION calculate_next_review(retry_count INTEGER, is_correct BOOLEAN)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  days_until_review INTEGER;
BEGIN
  IF NOT is_correct THEN
    RETURN NOW() + INTERVAL '1 day';
  END IF;
  CASE retry_count
    WHEN 0 THEN days_until_review := 1;
    WHEN 1 THEN days_until_review := 3;
    WHEN 2 THEN days_until_review := 7;
    WHEN 3 THEN days_until_review := 14;
    ELSE days_until_review := 30;
  END CASE;
  RETURN NOW() + (days_until_review || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- 학생 XP 업데이트 (게임화)
CREATE OR REPLACE FUNCTION update_student_xp(
  p_student_id UUID,
  p_xp INTEGER
) RETURNS VOID AS $$
DECLARE
  v_new_xp INTEGER;
  v_new_level INTEGER;
BEGIN
  INSERT INTO student_gamification (student_id, xp, level, total_questions_solved, updated_at)
  VALUES (p_student_id, p_xp, 1, 1, NOW())
  ON CONFLICT (student_id) DO UPDATE SET
    xp = student_gamification.xp + p_xp,
    total_questions_solved = student_gamification.total_questions_solved + 1,
    updated_at = NOW()
  RETURNING xp INTO v_new_xp;

  -- 레벨 계산: 100xp마다 1레벨 상승
  v_new_level := GREATEST(1, v_new_xp / 100 + 1);

  UPDATE student_gamification
  SET level = v_new_level
  WHERE student_id = p_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 추가 테이블 (확장 기능)
-- =============================================

-- 시험 배포 (반별 시험 일정 관리)
CREATE TABLE IF NOT EXISTS exam_deployments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  time_limit_mins INTEGER,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'grading', 'completed')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 알림
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('exam_reminder', 'result_published', 'encouragement')),
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'telegram')),
  message TEXT,
  exam_deployment_id UUID REFERENCES exam_deployments(id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 단어장 세트
CREATE TABLE IF NOT EXISTS vocab_sets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  difficulty NUMERIC(2,1),
  word_level TEXT DEFAULT 'toefl' CHECK (word_level IN ('elem_1_2','elem_3_4','elem_5_6','middle','toefl')),
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 단어
CREATE TABLE IF NOT EXISTS vocab_words (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  set_id UUID REFERENCES vocab_sets(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  part_of_speech TEXT,              -- 품사 (noun, verb, adjective, adverb 등)
  definition_ko TEXT,               -- 한국어 뜻
  definition_en TEXT,               -- 영어 정의
  synonyms TEXT[],                  -- 동의어 배열
  antonyms TEXT[],                  -- 반의어 배열
  idioms TEXT[] DEFAULT '{}',       -- 숙어/관용표현 배열
  topic_category TEXT,              -- 주제 카테고리 (biology, history_us 등)
  difficulty NUMERIC(2,1) CHECK (difficulty BETWEEN 1 AND 5),
  word_level TEXT DEFAULT 'toefl' CHECK (word_level IN ('elem_1_2','elem_3_4','elem_5_6','middle','toefl')),
  example_sentence TEXT,            -- 청크 분절 예문 (영어)
  example_sentence_ko TEXT,         -- 청크 분절 예문 (한국어)
  morphemes JSONB,                  -- 어원 분석 {prefix, prefix_meaning, root, root_meaning, suffix, suffix_meaning}
  collocations JSONB,               -- 연어 표현 배열 ["make a prediction", "accurate prediction"]
  audio_url TEXT,
  order_num INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 학생 단어 학습 기록
CREATE TABLE IF NOT EXISTS student_vocab_progress (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  word_id UUID REFERENCES vocab_words(id) ON DELETE CASCADE NOT NULL,
  mastered BOOLEAN DEFAULT FALSE,
  review_count INTEGER DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  UNIQUE(student_id, word_id)
);

-- classes 테이블 target_band 칼럼 (누락된 경우)
-- ALTER TABLE classes ADD COLUMN IF NOT EXISTS target_band NUMERIC(3,1);

-- profiles 테이블 Telegram 필드 (누락된 경우)
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_username TEXT;
