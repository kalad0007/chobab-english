-- =============================================
-- 초대코드 기반 선생님-원장님 연결 시스템
-- 1. profiles에 invite_code, managed_by 컬럼 추가
-- 2. superadmin role 허용
-- 3. handle_new_user trigger 업데이트 (managed_by 처리)
-- =============================================

-- 1. profiles role 제약 조건에 superadmin 추가
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'teacher', 'admin', 'superadmin'));

-- 2. invite_code 컬럼 추가 (admin 승인 시 자동 생성)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

-- 3. managed_by 컬럼 추가 (강사가 소속된 admin의 id)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS managed_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 4. handle_new_user trigger 업데이트 — managed_by를 metadata에서 읽어 저장
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name, role, managed_by)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    NULLIF(NEW.raw_user_meta_data->>'managed_by', '')::uuid
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
