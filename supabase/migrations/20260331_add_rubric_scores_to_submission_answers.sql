-- Add rubric_scores column to submission_answers
-- Used for Writing/Speaking multi-dimensional rubric grading
ALTER TABLE submission_answers
  ADD COLUMN IF NOT EXISTS rubric_scores jsonb DEFAULT NULL;

COMMENT ON COLUMN submission_answers.rubric_scores IS
  '루브릭 채점 결과 JSON. Writing: {task_achievement, coherence, language_use} (각 1~4). Speaking: {delivery, language_use, topic_development} (각 1~4). 합산 후 maxScore에 비례 환산.';
