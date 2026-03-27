-- Add time_limit column to questions table
-- Unit: seconds (초)
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS time_limit integer DEFAULT NULL;

COMMENT ON COLUMN questions.time_limit IS '문제당 제한시간(초). NULL이면 subtype 기본값 사용';
