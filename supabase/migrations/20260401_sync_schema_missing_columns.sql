-- =============================================
-- schema.sql 누락 칼럼 동기화 마이그레이션
-- 실제 DB에 이미 존재하지 않는 경우에만 적용됨
-- =============================================

-- exams 테이블 누락 칼럼
ALTER TABLE exams ADD COLUMN IF NOT EXISTS exam_type TEXT DEFAULT 'practice'
  CHECK (exam_type IN ('full_test', 'section_test', 'practice'));
ALTER TABLE exams ADD COLUMN IF NOT EXISTS sections TEXT[];
ALTER TABLE exams ADD COLUMN IF NOT EXISTS max_band_ceiling NUMERIC(3,1) DEFAULT 6.0;

-- submissions 테이블 누락 칼럼 (TOEFL 밴드 점수)
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS deployment_id UUID;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS overall_band NUMERIC(3,1);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS reading_band NUMERIC(3,1);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS listening_band NUMERIC(3,1);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS writing_band NUMERIC(3,1);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS speaking_band NUMERIC(3,1);

-- submission_answers 테이블 누락 칼럼
ALTER TABLE submission_answers ADD COLUMN IF NOT EXISTS rubric_scores JSONB;

-- questions 테이블 누락 칼럼
ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_subtype TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS preparation_time INTEGER;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS response_time INTEGER;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS word_limit INTEGER;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS task_number INTEGER;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS time_limit INTEGER;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS audio_script TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS audio_play_limit INTEGER;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS speaking_prompt TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS passage_id TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS audio_id TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS passage_group_id UUID;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS email_to TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS email_subject TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS vocab_words JSONB;

-- questions.category CHECK 제약 업데이트 (listening, speaking 추가)
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_category_check;
ALTER TABLE questions ADD CONSTRAINT questions_category_check
  CHECK (category IN ('grammar', 'vocabulary', 'reading', 'writing', 'listening', 'speaking', 'cloze', 'ordering'));

-- classes 테이블 누락 칼럼
ALTER TABLE classes ADD COLUMN IF NOT EXISTS target_band NUMERIC(3,1);

-- profiles 테이블 Telegram 필드
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_username TEXT;

-- =============================================
-- update_student_xp RPC 함수 생성
-- =============================================
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
-- 추가 테이블 생성 (없는 경우)
-- =============================================

-- 시험 배포 테이블
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

-- 알림 테이블
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
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 단어
CREATE TABLE IF NOT EXISTS vocab_words (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  set_id UUID REFERENCES vocab_sets(id) ON DELETE CASCADE NOT NULL,
  word TEXT NOT NULL,
  pos TEXT,
  definition TEXT NOT NULL,
  example TEXT,
  audio_url TEXT,
  order_num INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
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

-- RLS 활성화 (새 테이블)
ALTER TABLE exam_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocab_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocab_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_vocab_progress ENABLE ROW LEVEL SECURITY;

-- 기본 RLS 정책
CREATE POLICY IF NOT EXISTS "exam_deployments_select" ON exam_deployments FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "notifications_select" ON notifications FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY IF NOT EXISTS "vocab_sets_select" ON vocab_sets FOR SELECT USING (auth.uid() = teacher_id OR is_published = true);
CREATE POLICY IF NOT EXISTS "vocab_words_select" ON vocab_words FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "student_vocab_progress_all" ON student_vocab_progress FOR ALL USING (auth.uid() = student_id);
