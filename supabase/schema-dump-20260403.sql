-- ============================================================
-- Chobabsaem TOEFL — Full Schema Dump
-- Date: 2026-04-03
-- Tables: 31
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. profiles
-- Auth 사용자와 1:1 연결되는 사용자 프로필 (선생님 / 학생)
-- ============================================================
CREATE TABLE profiles (
  id                    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                 text        NOT NULL,
  name                  text        NOT NULL,
  role                  text        NOT NULL CHECK (role IN ('teacher', 'student')),
  avatar_url            text,
  telegram_chat_id      text,
  telegram_username     text,
  approved              boolean     NOT NULL DEFAULT false,
  plan                  text        NOT NULL DEFAULT 'free',
  plan_expires_at       timestamptz,
  ai_question_count     integer     NOT NULL DEFAULT 0,
  ai_question_reset_at  timestamptz NOT NULL DEFAULT now(),
  ai_vocab_count        integer     NOT NULL DEFAULT 0,
  ai_vocab_reset_at     timestamptz NOT NULL DEFAULT now(),
  coins                 integer     NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. plan_limits
-- 플랜별 기능 제한 설정 (free / starter / basic / pro / premium)
-- ============================================================
CREATE TABLE plan_limits (
  plan                   text    PRIMARY KEY,
  max_students           integer,
  max_classes            integer,
  max_exams              integer,
  ai_questions_per_month integer,
  ai_vocab_per_month     integer,
  features               jsonb   NOT NULL
);

-- ============================================================
-- 3. classes
-- 선생님이 개설한 수업 클래스
-- ============================================================
CREATE TABLE classes (
  id          uuid    PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id  uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        text    NOT NULL,
  grade       integer,
  invite_code text    NOT NULL UNIQUE,
  description text,
  target_band numeric,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. class_members
-- 수업에 참여한 학생 목록
-- ============================================================
CREATE TABLE class_members (
  id            uuid    PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id      uuid    NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id    uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at     timestamptz NOT NULL DEFAULT now(),
  feature_level integer NOT NULL DEFAULT 1
);

-- ============================================================
-- 5. passages
-- 리딩/리스닝 지문 (문단 단위로 passage_paragraphs에 저장)
-- ============================================================
CREATE TABLE passages (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title           text    NOT NULL,
  topic_category  text    NOT NULL DEFAULT 'general',
  difficulty      numeric NOT NULL DEFAULT 3,
  source          text,
  is_published    boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. passage_paragraphs
-- 지문의 문단별 텍스트, 한국어 번역, 어휘 주석
-- ============================================================
CREATE TABLE passage_paragraphs (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  passage_id  uuid    NOT NULL REFERENCES passages(id) ON DELETE CASCADE,
  order_num   integer NOT NULL,
  text        text    NOT NULL,
  text_ko     text,
  annotations jsonb   NOT NULL DEFAULT '[]',
  explanation text,
  vocab_json  jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 7. questions
-- 모든 유형의 문제 (선택형 / 단답형 / 서술형)
-- ============================================================
CREATE TABLE questions (
  id               uuid    PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id       uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type             text    NOT NULL CHECK (type IN ('multiple_choice', 'short_answer', 'essay')),
  content          text    NOT NULL,
  passage          text,
  options          jsonb,
  answer           text    NOT NULL,
  explanation      text,
  category         text    NOT NULL CHECK (category IN ('grammar','vocabulary','reading','writing','listening','speaking','cloze','ordering')),
  subcategory      text,
  difficulty       float8  NOT NULL,
  source           text    NOT NULL DEFAULT 'teacher',
  attempt_count    integer NOT NULL DEFAULT 0,
  correct_count    integer NOT NULL DEFAULT 0,
  is_active        boolean NOT NULL DEFAULT true,
  -- 리스닝 / 스피킹
  audio_url        text,
  audio_script     text,
  audio_play_limit integer NOT NULL DEFAULT 3,
  speaking_prompt  text,
  -- TOEFL 세부 필드
  question_subtype text,
  preparation_time integer,
  response_time    integer,
  word_limit       integer,
  task_number      integer,
  -- 지문 / 오디오 그룹핑
  audio_id         uuid,
  passage_id       uuid    REFERENCES passages(id) ON DELETE SET NULL,
  passage_group_id uuid,
  -- 기타
  summary          text,
  time_limit       integer,
  max_score        float8  NOT NULL DEFAULT 1,
  vocab_words      jsonb,
  set_order        integer,
  email_to         text,
  email_subject    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 8. passage_questions
-- 지문과 문제의 다대다 연결
-- ============================================================
CREATE TABLE passage_questions (
  passage_id  uuid    NOT NULL REFERENCES passages(id) ON DELETE CASCADE,
  question_id uuid    NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  order_num   integer NOT NULL DEFAULT 1,
  PRIMARY KEY (passage_id, question_id)
);

-- ============================================================
-- 9. passage_classes
-- 지문과 클래스의 다대다 연결 (배포)
-- ============================================================
CREATE TABLE passage_classes (
  passage_id uuid NOT NULL REFERENCES passages(id) ON DELETE CASCADE,
  class_id   uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  PRIMARY KEY (passage_id, class_id)
);

-- ============================================================
-- 10. exams
-- 선생님이 생성한 시험
-- ============================================================
CREATE TABLE exams (
  id                      uuid    PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id              uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id                uuid    REFERENCES classes(id) ON DELETE SET NULL,
  title                   text    NOT NULL,
  description             text,
  time_limit              integer,
  start_at                timestamptz,
  end_at                  timestamptz,
  status                  text    NOT NULL DEFAULT 'draft',
  show_result_immediately boolean NOT NULL DEFAULT false,
  total_points            integer NOT NULL DEFAULT 100,
  max_band_ceiling        float8  NOT NULL DEFAULT 6,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 11. exam_questions
-- 시험에 포함된 문제 목록 (순서 및 배점)
-- ============================================================
CREATE TABLE exam_questions (
  id          uuid    PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id     uuid    NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_id uuid    NOT NULL,
  order_num   integer NOT NULL,
  points      integer NOT NULL DEFAULT 5
);

-- ============================================================
-- 12. exam_deployments
-- 시험을 특정 클래스에 배포한 일정
-- ============================================================
CREATE TABLE exam_deployments (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id         uuid    NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  class_id        uuid    NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  start_at        timestamptz NOT NULL,
  end_at          timestamptz NOT NULL,
  time_limit_mins integer,
  status          text    NOT NULL DEFAULT 'scheduled',
  published_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 13. submissions
-- 학생의 시험 제출 기록
-- ============================================================
CREATE TABLE submissions (
  id             uuid    PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id        uuid    NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id     uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  deployment_id  uuid    REFERENCES exam_deployments(id) ON DELETE SET NULL,
  score          integer,
  total_points   integer,
  percentage     numeric,
  started_at     timestamptz NOT NULL DEFAULT now(),
  submitted_at   timestamptz,
  status         text    NOT NULL DEFAULT 'in_progress',
  -- TOEFL 섹션별 밴드 점수
  reading_band   float8,
  listening_band float8,
  writing_band   float8,
  speaking_band  float8,
  overall_band   float8
);

-- ============================================================
-- 14. submission_answers
-- 제출된 개별 문제 답안
-- ============================================================
CREATE TABLE submission_answers (
  id               uuid    PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id    uuid    NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  question_id      uuid    NOT NULL,
  student_answer   text,
  is_correct       boolean,
  score            numeric NOT NULL DEFAULT 0,
  teacher_feedback text,
  rubric_scores    jsonb
);

-- ============================================================
-- 15. wrong_answer_queue
-- 오답 복습 큐 (스페이스드 리피티션)
-- ============================================================
CREATE TABLE wrong_answer_queue (
  id                   uuid    PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id           uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  original_question_id uuid    NOT NULL,
  generated_question_id uuid,
  retry_count          integer NOT NULL DEFAULT 0,
  next_review_at       timestamptz NOT NULL DEFAULT now(),
  mastered             boolean NOT NULL DEFAULT false,
  last_attempt_at      timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 16. student_skill_stats
-- 학생의 카테고리별 정답률 통계
-- ============================================================
CREATE TABLE student_skill_stats (
  id            uuid    PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id    uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category      text    NOT NULL,
  total_count   integer NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  accuracy      numeric NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 17. student_gamification
-- 학생 게임화 정보 (XP, 레벨, 스트릭)
-- ============================================================
CREATE TABLE student_gamification (
  id                    uuid    PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id            uuid    NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  xp                    integer NOT NULL DEFAULT 0,
  level                 integer NOT NULL DEFAULT 1,
  streak_days           integer NOT NULL DEFAULT 0,
  last_activity_date    date,
  total_questions_solved integer NOT NULL DEFAULT 0,
  total_correct         integer NOT NULL DEFAULT 0,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 18. learning_contents
-- 선생님이 작성한 학습 콘텐츠 (공지, 학습자료 등)
-- ============================================================
CREATE TABLE learning_contents (
  id           uuid    PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id   uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id     uuid    REFERENCES classes(id) ON DELETE SET NULL,
  title        text    NOT NULL,
  content      text    NOT NULL,
  category     text,
  is_published boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 19. learning_assets
-- 선생님이 업로드한 오디오, 이미지 등 학습 자료
-- ============================================================
CREATE TABLE learning_assets (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  asset_type  text    NOT NULL,
  title       text    NOT NULL,
  description text,
  tags        text[],
  file_url    text,
  transcript  text,
  metadata    jsonb,
  is_public   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 20. notifications
-- 인앱 / 텔레그램 알림
-- ============================================================
CREATE TABLE notifications (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id        uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type                text    NOT NULL,
  channel             text    NOT NULL DEFAULT 'in_app',
  message             text,
  exam_deployment_id  uuid    REFERENCES exam_deployments(id) ON DELETE SET NULL,
  read_at             timestamptz,
  sent_at             timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 21. vocab_sets
-- 단어장 세트
-- ============================================================
CREATE TABLE vocab_sets (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id     uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title          text    NOT NULL,
  topic_category text,
  difficulty     numeric,
  word_count     integer NOT NULL DEFAULT 0,
  is_published   boolean NOT NULL DEFAULT false,
  published_at   timestamptz,
  word_level     text    NOT NULL DEFAULT 'toefl',
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 22. vocab_words
-- 개별 단어 데이터 (정의, 예문, 형태소 등)
-- ============================================================
CREATE TABLE vocab_words (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id        uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  word              text    NOT NULL,
  part_of_speech    text    NOT NULL DEFAULT 'adjective',
  definition_ko     text    NOT NULL DEFAULT '',
  definition_en     text    NOT NULL DEFAULT '',
  synonyms          text[]  NOT NULL DEFAULT '{}',
  antonyms          text[]  NOT NULL DEFAULT '{}',
  topic_category    text    NOT NULL DEFAULT 'general',
  difficulty        numeric NOT NULL DEFAULT 3,
  audio_url         text,
  example_sentence  text,
  example_sentence_ko text,
  idioms            text[],
  morphemes         jsonb,
  collocations      jsonb,
  word_level        text    NOT NULL DEFAULT 'toefl',
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 23. vocab_set_words
-- 단어장 세트와 단어의 다대다 연결
-- ============================================================
CREATE TABLE vocab_set_words (
  set_id    uuid    NOT NULL REFERENCES vocab_sets(id) ON DELETE CASCADE,
  word_id   uuid    NOT NULL REFERENCES vocab_words(id) ON DELETE CASCADE,
  order_num integer NOT NULL DEFAULT 0,
  PRIMARY KEY (set_id, word_id)
);

-- ============================================================
-- 24. vocab_set_classes
-- 단어장 세트와 클래스의 다대다 연결 (배포)
-- ============================================================
CREATE TABLE vocab_set_classes (
  set_id   uuid NOT NULL REFERENCES vocab_sets(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  PRIMARY KEY (set_id, class_id)
);

-- ============================================================
-- 25. vocab_topics
-- 단어 주제 카테고리 (선생님 커스텀)
-- ============================================================
CREATE TABLE vocab_topics (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  value      text NOT NULL,
  label      text NOT NULL,
  emoji      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 26. vocab_progress
-- 학생별 단어 학습 진행도 (스페이스드 리피티션 SM-2)
-- ============================================================
CREATE TABLE vocab_progress (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  word_id        uuid    NOT NULL REFERENCES vocab_words(id) ON DELETE CASCADE,
  ease_factor    float8  NOT NULL DEFAULT 2.5,
  interval_days  integer NOT NULL DEFAULT 0,
  repetitions    integer NOT NULL DEFAULT 0,
  next_review_at timestamptz NOT NULL DEFAULT now(),
  last_rating    integer,
  total_reviews  integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 27. student_words
-- 학생이 지문에서 저장한 개인 단어장
-- ============================================================
CREATE TABLE student_words (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  word          text NOT NULL,
  meaning_ko    text,
  context       text,
  passage_id    uuid REFERENCES passages(id) ON DELETE SET NULL,
  passage_title text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 28. collocation_quizzes
-- 콜로케이션 퀴즈 세트
-- ============================================================
CREATE TABLE collocation_quizzes (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  set_id     uuid    REFERENCES vocab_sets(id) ON DELETE SET NULL,
  title      text    NOT NULL,
  status     text    NOT NULL DEFAULT 'draft',
  order_num  integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 29. collocation_quiz_items
-- 콜로케이션 퀴즈의 개별 문항
-- ============================================================
CREATE TABLE collocation_quiz_items (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id     uuid    NOT NULL REFERENCES collocation_quizzes(id) ON DELETE CASCADE,
  word_id     uuid    NOT NULL REFERENCES vocab_words(id) ON DELETE CASCADE,
  collocation text    NOT NULL,
  order_num   integer NOT NULL DEFAULT 0
);

-- ============================================================
-- 30. collocation_quiz_classes
-- 콜로케이션 퀴즈와 클래스의 다대다 연결
-- ============================================================
CREATE TABLE collocation_quiz_classes (
  quiz_id  uuid NOT NULL REFERENCES collocation_quizzes(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  PRIMARY KEY (quiz_id, class_id)
);

-- ============================================================
-- 31. collocation_quiz_progress
-- 학생별 콜로케이션 퀴즈 플레이 기록
-- ============================================================
CREATE TABLE collocation_quiz_progress (
  student_id     uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quiz_id        uuid    NOT NULL REFERENCES collocation_quizzes(id) ON DELETE CASCADE,
  best_coins     integer NOT NULL DEFAULT 0,
  best_correct   integer NOT NULL DEFAULT 0,
  attempts       integer NOT NULL DEFAULT 0,
  last_played_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, quiz_id)
);

-- ============================================================
-- RPC Functions (정의 참고용)
-- ============================================================

-- update_student_skill_stats(p_student_id uuid, p_category text, p_is_correct boolean)
--   -> student_skill_stats의 total_count, correct_count, accuracy를 upsert

-- calculate_next_review(retry_count integer, is_correct boolean)
--   -> 스페이스드 리피티션 알고리즘으로 다음 복습 시각 반환

-- update_student_xp(p_student_id uuid, p_xp integer)
--   -> student_gamification의 xp, level, streak 업데이트

-- increment_coins(user_id uuid, amount integer)
--   -> profiles.coins를 원자적으로 증가

-- ============================================================
-- Trigger
-- ============================================================

-- on_auth_user_created AFTER INSERT ON auth.users
--   -> handle_new_user() : profiles 테이블에 자동으로 row 생성
