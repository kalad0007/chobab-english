-- 코인 시스템: profiles에 coins 컬럼 추가
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS coins INT NOT NULL DEFAULT 0;

-- 스와이프 퀴즈 레벨 순서: collocation_quizzes에 order_num 추가
ALTER TABLE collocation_quizzes ADD COLUMN IF NOT EXISTS order_num INT NOT NULL DEFAULT 0;
