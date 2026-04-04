CREATE TABLE credit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,  -- 양수=충전/수신, 음수=사용/이전
  type TEXT NOT NULL CHECK (type IN ('charge', 'transfer_in', 'transfer_out', 'usage')),
  description TEXT,  -- 예: 'AI 문제 생성', '슈퍼어드민 충전', '강사에게 이전' 등
  related_user_id UUID REFERENCES profiles(id),  -- 이전 상대방
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_credit_logs_user_id ON credit_logs(user_id);
CREATE INDEX idx_credit_logs_created_at ON credit_logs(created_at);
