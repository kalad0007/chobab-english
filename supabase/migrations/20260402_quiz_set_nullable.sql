-- 개별 단어 퀴즈를 위해 set_id nullable로 변경
ALTER TABLE collocation_quizzes ALTER COLUMN set_id DROP NOT NULL;
