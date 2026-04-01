-- vocab_words에 word_level 추가
ALTER TABLE vocab_words ADD COLUMN IF NOT EXISTS word_level TEXT DEFAULT 'toefl' CHECK (word_level IN ('elementary', 'toefl'));

-- vocab_sets에 word_level 추가
ALTER TABLE vocab_sets ADD COLUMN IF NOT EXISTS word_level TEXT DEFAULT 'toefl' CHECK (word_level IN ('elementary', 'toefl'));

-- difficulty 컬럼 타입 수정 (INTEGER → NUMERIC(2,1))
-- schema.sql은 INTEGER로 되어 있으나 UI는 소수점(1.5, 2.5 등) 사용 중 → DB와 일치시킴
ALTER TABLE vocab_words ALTER COLUMN difficulty TYPE NUMERIC(2,1);
ALTER TABLE vocab_sets ALTER COLUMN difficulty TYPE NUMERIC(2,1);
