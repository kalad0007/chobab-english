-- ──────────────────────────────────────────────────────────────────
-- 시험 배포(Deployment) 시스템
-- 하나의 시험을 여러 반에 각각 다른 기간/설정으로 배포
-- ──────────────────────────────────────────────────────────────────

-- 1. 시험 배포 테이블 (배포 단위 = B안 카드 단위)
CREATE TABLE IF NOT EXISTS exam_deployments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id          UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  class_id         UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  start_at         TIMESTAMPTZ NOT NULL,
  end_at           TIMESTAMPTZ NOT NULL,
  time_limit_mins  INTEGER,          -- 분 단위, null이면 exam.time_limit 사용
  status           TEXT NOT NULL DEFAULT 'scheduled'
                   CHECK (status IN ('scheduled','active','grading','completed')),
  published_at     TIMESTAMPTZ,      -- 선생님이 최종 성적 확정한 시각
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam_id, class_id)
);

-- 2. submissions에 deployment_id 추가 (nullable — 기존 데이터 호환)
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS deployment_id UUID REFERENCES exam_deployments(id);

-- 3. profiles에 텔레그램 필드 추가 (차후 알림 확장 대비)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id    TEXT,
  ADD COLUMN IF NOT EXISTS telegram_username   TEXT;

-- 4. 알림 테이블 (앱 내 알림 시작, 텔레그램 확장 대비)
CREATE TABLE IF NOT EXISTS notifications (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type                 TEXT NOT NULL,   -- 'exam_reminder'|'result_published'|'encouragement'
  channel              TEXT NOT NULL DEFAULT 'in_app',  -- 'in_app'|'telegram'
  message              TEXT,
  exam_deployment_id   UUID REFERENCES exam_deployments(id) ON DELETE CASCADE,
  read_at              TIMESTAMPTZ,
  sent_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. 인덱스
CREATE INDEX IF NOT EXISTS idx_exam_deployments_exam    ON exam_deployments(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_deployments_class   ON exam_deployments(class_id);
CREATE INDEX IF NOT EXISTS idx_exam_deployments_status  ON exam_deployments(status);
CREATE INDEX IF NOT EXISTS idx_submissions_deployment   ON submissions(deployment_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient  ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread     ON notifications(recipient_id, read_at)
  WHERE read_at IS NULL;

-- 6. RLS (Row Level Security) — 기존 패턴 동일하게
ALTER TABLE exam_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;

-- 선생님: 자신의 시험 배포만 관리
CREATE POLICY "teacher_own_deployments" ON exam_deployments
  FOR ALL USING (
    exam_id IN (SELECT id FROM exams WHERE teacher_id = auth.uid())
  );

-- 학생: 자신의 반에 배포된 시험만 조회
CREATE POLICY "student_view_deployments" ON exam_deployments
  FOR SELECT USING (
    class_id IN (
      SELECT class_id FROM class_members WHERE student_id = auth.uid()
    )
  );

-- 알림: 본인 것만
CREATE POLICY "own_notifications" ON notifications
  FOR ALL USING (recipient_id = auth.uid());
