# 초밥샘의 영어공부 - 설정 가이드

## 1. Supabase 프로젝트 생성

1. https://supabase.com 접속 → 무료 계정 생성
2. "New Project" 클릭
3. 프로젝트 이름: `chobabsaem-english` (원하는 이름)
4. 비밀번호 설정 후 생성 (약 2분 소요)

## 2. 데이터베이스 스키마 적용

1. Supabase 대시보드 → **SQL Editor** 탭
2. `supabase/schema.sql` 파일 내용을 붙여넣기
3. **Run** 버튼 클릭

## 3. 환경변수 설정

Supabase 대시보드 → **Settings** → **API** 에서:

`.env.local` 파일 수정:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co  # Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...                   # anon public key
SUPABASE_SERVICE_ROLE_KEY=eyJ...                       # service_role key
```

## 4. Claude API 키 설정

1. https://console.anthropic.com 접속
2. API Keys → Create Key
3. `.env.local`에 추가:
```
ANTHROPIC_API_KEY=sk-ant-...
```

## 5. 개발 서버 실행

```bash
cd chobabsaem-english
npm run dev
```

브라우저에서 http://localhost:3000 접속

## 6. 첫 사용

1. `/register` 에서 **선생님 계정** 생성
2. `/teacher/classes` 에서 반 만들기
3. 반의 **초대 코드**를 학생에게 전달
4. 학생은 `/join` 에서 초대 코드로 가입

## 7. Vercel 배포 (선택)

```bash
npm install -g vercel
vercel
```

Vercel 대시보드에서 환경변수 동일하게 설정

---

## 구현된 기능 목록

### 선생님
- ✅ 로그인/회원가입
- ✅ 대시보드 (통계 요약)
- ✅ 문제은행 (직접 출제)
- ✅ AI 문제 생성 (Claude Sonnet)
- ✅ 통계 분석 (영역별 정답률, 학생별 현황)
- 🚧 시험 생성/배포 (개발 예정)
- 🚧 채점 관리 (개발 예정)
- 🚧 반/학생 관리 (개발 예정)

### 학생
- ✅ 초대코드 회원가입
- ✅ 대시보드 (XP, 레벨, 스트릭)
- ✅ 시험 응시 (자동 채점, 타이머)
- ✅ 시험 결과 확인
- ✅ 오답 복습 (Spaced Repetition)
- ✅ AI 유사문제 생성
- 🚧 학습 자료 (개발 예정)
