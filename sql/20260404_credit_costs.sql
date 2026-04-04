CREATE TABLE IF NOT EXISTS public.credit_costs (
  id text PRIMARY KEY,
  label text NOT NULL,
  category text NOT NULL DEFAULT '기타',
  cost integer NOT NULL DEFAULT 10,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.credit_costs ENABLE ROW LEVEL SECURITY;

-- 슈퍼관리자만 수정 가능
CREATE POLICY "superadmin_manage_credit_costs" ON public.credit_costs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- 모든 인증 사용자 읽기 가능 (단가 조회용)
CREATE POLICY "authenticated_read_credit_costs" ON public.credit_costs
  FOR SELECT USING (auth.role() = 'authenticated');

-- 기본 데이터 삽입
INSERT INTO public.credit_costs (id, label, category, cost) VALUES
  ('choose_response', '객관식 문제', '문제 생성', 5),
  ('complete_the_words', '단어 완성', '문제 생성', 5),
  ('sentence_reordering', '문장 배열', '문제 생성', 5),
  ('daily_life_email', '일상 이메일', '문제 생성', 10),
  ('daily_life_text_chain', '문자 대화', '문제 생성', 10),
  ('daily_life_notice', '안내문', '문제 생성', 10),
  ('daily_life_guide', '가이드', '문제 생성', 10),
  ('daily_life_article', '기사', '문제 생성', 10),
  ('daily_life_campus_notice', '캠퍼스 공지', '문제 생성', 10),
  ('academic_passage', '학술 지문', '문제 생성', 10),
  ('conversation', '대화', '문제 생성', 10),
  ('academic_talk', '학술 강의', '문제 생성', 10),
  ('campus_announcement', '캠퍼스 안내', '문제 생성', 10),
  ('email_writing', '이메일 작문', '문제 생성', 10),
  ('academic_discussion', '학술 토론', '문제 생성', 10),
  ('listen_and_repeat', '듣고 따라하기', '문제 생성', 10),
  ('take_an_interview', '인터뷰', '문제 생성', 10),
  ('sentence_completion', '문장 완성', '문제 생성', 10),
  ('vocab_per_word', '어휘 생성 (단어당)', '어휘', 2),
  ('collocation_quiz', '콜로케이션 퀴즈', '어휘', 20),
  ('passage_translation', '지문 번역/해설', '지문', 5),
  ('speaking_eval', '스피킹 평가', '평가/기타', 5),
  ('tts', '음성 합성 (TTS)', '평가/기타', 1)
ON CONFLICT (id) DO NOTHING;
