-- 2026-04-01: vocab_words 테이블에 morphemes(어원 분석) + collocations(연어) 컬럼 추가
ALTER TABLE vocab_words ADD COLUMN IF NOT EXISTS morphemes JSONB;
ALTER TABLE vocab_words ADD COLUMN IF NOT EXISTS collocations JSONB;

COMMENT ON COLUMN vocab_words.morphemes IS '어원 분석 (예: {"prefix":"pre","prefix_meaning":"before","root":"dict","root_meaning":"say","suffix":"ion","suffix_meaning":"noun form"})';
COMMENT ON COLUMN vocab_words.collocations IS '연어 표현 배열 (예: ["make a prediction","accurate prediction","bold prediction"])';
