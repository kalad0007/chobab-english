-- =============================================
-- 어휘 관련 테이블 데이터 초기화
-- 대상: student_vocab_progress → vocab_words → vocab_sets
--
-- schema.sql 기준 FK 관계:
--   student_vocab_progress.word_id  → vocab_words(id)  ON DELETE CASCADE
--   student_vocab_progress.student_id → profiles(id)   ON DELETE CASCADE
--   vocab_words.set_id              → vocab_sets(id)   ON DELETE CASCADE
--   vocab_words.teacher_id          → profiles(id)     ON DELETE CASCADE
--   vocab_sets.teacher_id           → profiles(id)     ON DELETE CASCADE
--   vocab_sets.class_id             → classes(id)      ON DELETE SET NULL
--
-- 주의: TRUNCATE CASCADE 미사용 — 의도치 않은 연쇄 삭제 방지를 위해
--       FK 의존 순서대로 DELETE FROM 을 명시적으로 실행합니다.
-- =============================================

BEGIN;

-- -----------------------------------------------
-- Step 1. 학생 단어 학습 기록 삭제
--   가장 하위 자식 테이블. vocab_words를 참조하므로 먼저 제거.
-- -----------------------------------------------
DELETE FROM student_vocab_progress;

-- -----------------------------------------------
-- Step 2. 단어 삭제
--   vocab_sets를 참조(set_id)하므로 vocab_sets 삭제 전에 제거.
--   student_vocab_progress가 이미 비워졌으므로 FK 위반 없음.
-- -----------------------------------------------
DELETE FROM vocab_words;

-- -----------------------------------------------
-- Step 3. 단어 세트 삭제
--   vocab_words, (필요 시 추가될) vocab_set_words·vocab_set_classes 등
--   하위 자식이 모두 제거된 뒤 마지막으로 제거.
-- -----------------------------------------------
DELETE FROM vocab_sets;

COMMIT;
