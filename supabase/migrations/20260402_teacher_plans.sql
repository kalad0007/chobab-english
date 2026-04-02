-- 1. profiles 테이블에 플랜 관련 컬럼 추가
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'lite', 'standard', 'pro', 'premium')),
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_question_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_question_reset_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS ai_vocab_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_vocab_reset_at TIMESTAMPTZ DEFAULT NOW();

-- role에 admin 추가
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('student', 'teacher', 'admin'));

-- 2. plan_limits 테이블 생성
CREATE TABLE IF NOT EXISTS plan_limits (
  plan TEXT PRIMARY KEY,
  max_students INT,           -- NULL = 무제한
  max_classes INT,
  max_exams INT,
  ai_questions_per_month INT, -- NULL = 무제한
  ai_vocab_per_month INT,
  features JSONB NOT NULL DEFAULT '{}'
);

-- 기존 데이터 삭제 후 삽입
DELETE FROM plan_limits;
INSERT INTO plan_limits VALUES
  ('free',     3,    1,  3,   10,  5,   '{"smart_builder":false,"analytics_full":false,"passage_write":false}'),
  ('lite',     10,   2,  10,  30,  15,  '{"smart_builder":false,"analytics_full":false,"passage_write":true}'),
  ('standard', 30,   5,  NULL,100, 50,  '{"smart_builder":true,"analytics_full":true,"passage_write":true}'),
  ('pro',      80,   15, NULL,300, 150, '{"smart_builder":true,"analytics_full":true,"passage_write":true}'),
  ('premium',  NULL, NULL,NULL,NULL,NULL,'{"smart_builder":true,"analytics_full":true,"passage_write":true,"api_access":true}');
