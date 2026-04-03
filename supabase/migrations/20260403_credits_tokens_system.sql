-- =============================================
-- 크레딧/토큰 시스템 마이그레이션
-- coins → tokens (학생 보상)
-- ai_question_count/ai_vocab_count → credits (선생님 AI 크레딧)
-- plan_limits 4단계로 재구성
-- =============================================

-- 1. profiles 테이블: coins → tokens
ALTER TABLE profiles RENAME COLUMN coins TO tokens;

-- 2. profiles 테이블: AI 카운트 → 크레딧
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 100;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits_reset_at TIMESTAMPTZ DEFAULT now();

-- 기존 카운트 컬럼 삭제
ALTER TABLE profiles DROP COLUMN IF EXISTS ai_question_count;
ALTER TABLE profiles DROP COLUMN IF EXISTS ai_question_reset_at;
ALTER TABLE profiles DROP COLUMN IF EXISTS ai_vocab_count;
ALTER TABLE profiles DROP COLUMN IF EXISTS ai_vocab_reset_at;

-- 3. collocation_quiz_progress: best_coins → best_tokens
ALTER TABLE collocation_quiz_progress RENAME COLUMN best_coins TO best_tokens;

-- 4. RPC 함수 교체: increment_coins → increment_tokens
DROP FUNCTION IF EXISTS increment_coins(uuid, integer);

CREATE OR REPLACE FUNCTION increment_tokens(user_id UUID, amount INT)
RETURNS void AS $$
BEGIN
  UPDATE profiles SET tokens = tokens + amount WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. plan_limits 테이블 재구성 (5단계 → 4단계)
DELETE FROM plan_limits;

INSERT INTO plan_limits (plan, max_students, max_classes, max_exams, monthly_credits, features) VALUES
  ('free',     3,    1,   3,    100,  '{}'),
  ('standard', 20,   5,   NULL, 500,  '{"passage_write": true}'),
  ('pro',      100,  15,  NULL, 3000, '{"passage_write": true, "smart_builder": true, "analytics_full": true}'),
  ('premium',  300,  NULL, NULL, 7000, '{"passage_write": true, "smart_builder": true, "analytics_full": true, "api_access": true, "white_label": true}')
ON CONFLICT (plan) DO UPDATE SET
  max_students = EXCLUDED.max_students,
  max_classes = EXCLUDED.max_classes,
  max_exams = EXCLUDED.max_exams,
  monthly_credits = EXCLUDED.monthly_credits,
  features = EXCLUDED.features;

-- plan_limits에 monthly_credits 컬럼 추가 (없으면)
-- 기존 ai_questions_per_month, ai_vocab_per_month 삭제
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='plan_limits' AND column_name='monthly_credits') THEN
    ALTER TABLE plan_limits ADD COLUMN monthly_credits INTEGER DEFAULT 100;
  END IF;
END $$;

ALTER TABLE plan_limits DROP COLUMN IF EXISTS ai_questions_per_month;
ALTER TABLE plan_limits DROP COLUMN IF EXISTS ai_vocab_per_month;

-- 6. 기존 lite 플랜 사용자를 standard로 마이그레이션
UPDATE profiles SET plan = 'standard' WHERE plan = 'lite';

-- 7. profiles role 제약 조건 업데이트 (admin 포함 확인)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'teacher', 'admin'));
