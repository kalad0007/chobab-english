CREATE TABLE IF NOT EXISTS collocation_quiz_progress (
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quiz_id    UUID NOT NULL REFERENCES collocation_quizzes(id) ON DELETE CASCADE,
  best_coins    INT NOT NULL DEFAULT 0,
  best_correct  INT NOT NULL DEFAULT 0,
  attempts      INT NOT NULL DEFAULT 0,
  last_played_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (student_id, quiz_id)
);

ALTER TABLE collocation_quiz_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_own_quiz_progress" ON collocation_quiz_progress
  FOR ALL TO authenticated USING (student_id = auth.uid());

CREATE OR REPLACE FUNCTION increment_coins(user_id UUID, amount INT)
RETURNS void AS $$
BEGIN
  UPDATE profiles SET coins = coins + amount WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
