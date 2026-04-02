-- 연어 퀴즈 테이블
CREATE TABLE IF NOT EXISTS collocation_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  set_id UUID NOT NULL REFERENCES vocab_sets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 퀴즈 아이템 (word + collocation 쌍)
CREATE TABLE IF NOT EXISTS collocation_quiz_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES collocation_quizzes(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES vocab_words(id) ON DELETE CASCADE,
  collocation TEXT NOT NULL,
  order_num INT NOT NULL DEFAULT 0
);

-- 퀴즈 배포 반
CREATE TABLE IF NOT EXISTS collocation_quiz_classes (
  quiz_id UUID NOT NULL REFERENCES collocation_quizzes(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  PRIMARY KEY (quiz_id, class_id)
);

ALTER TABLE collocation_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE collocation_quiz_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE collocation_quiz_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_own_collocation_quizzes" ON collocation_quizzes
  FOR ALL TO authenticated USING (teacher_id = auth.uid());

CREATE POLICY "teacher_own_collocation_quiz_items" ON collocation_quiz_items
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM collocation_quizzes WHERE id = quiz_id AND teacher_id = auth.uid())
  );

CREATE POLICY "teacher_own_collocation_quiz_classes" ON collocation_quiz_classes
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM collocation_quizzes WHERE id = quiz_id AND teacher_id = auth.uid())
  );

-- 학생도 자신의 반에 배포된 퀴즈 읽기 가능
CREATE POLICY "student_read_collocation_quizzes" ON collocation_quizzes
  FOR SELECT TO authenticated USING (
    status = 'published' AND EXISTS (
      SELECT 1 FROM collocation_quiz_classes cqc
      JOIN class_members cm ON cm.class_id = cqc.class_id
      WHERE cqc.quiz_id = id AND cm.student_id = auth.uid()
    )
  );

CREATE POLICY "student_read_collocation_quiz_items" ON collocation_quiz_items
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM collocation_quizzes cq
      JOIN collocation_quiz_classes cqc ON cqc.quiz_id = cq.id
      JOIN class_members cm ON cm.class_id = cqc.class_id
      WHERE cq.id = quiz_id AND cq.status = 'published' AND cm.student_id = auth.uid()
    )
  );
