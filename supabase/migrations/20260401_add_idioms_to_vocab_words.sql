-- 2026-04-01: vocab_words 테이블에 idioms(숙어) 컬럼 추가
ALTER TABLE vocab_words
  ADD COLUMN IF NOT EXISTS idioms text[] DEFAULT '{}';

COMMENT ON COLUMN vocab_words.idioms IS '숙어/관용표현 목록 (예: ["take off", "run out of time"])';
