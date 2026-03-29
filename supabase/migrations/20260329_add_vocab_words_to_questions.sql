-- Add vocab_words column to questions table
-- Stores key vocabulary words with definitions as JSON array
-- Format: [{"word": "...", "def": "...", "example": "..."}]
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS vocab_words jsonb DEFAULT NULL;

COMMENT ON COLUMN questions.vocab_words IS '핵심 단어 목록 JSON: [{"word":"...","def":"...","example":"..."}]';
