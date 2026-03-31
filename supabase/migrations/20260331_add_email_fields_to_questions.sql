-- Add email_to and email_subject columns to questions table
-- Used for email_writing question type to display recipient and subject in the exam UI
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS email_to text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email_subject text DEFAULT NULL;

COMMENT ON COLUMN questions.email_to IS '이메일 작성 문제의 수신인 (예: Carl, your neighbor)';
COMMENT ON COLUMN questions.email_subject IS '이메일 작성 문제의 제목 (예: Apology for the noise)';
