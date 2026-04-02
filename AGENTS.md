## 푸시(Push) 규칙

**git push 및 vercel 배포는 반드시 사용자에게 먼저 확인 후 진행한다.**

- 코드 수정 완료 후 "푸시할까요?" 라고 물어볼 것
- 사용자가 명시적으로 "푸시해줘", "배포해줘" 라고 한 경우에만 실행
- 자동으로 push/deploy 하지 않을 것

## 마이그레이션 규칙

**새 마이그레이션 SQL 파일을 생성하면 반드시 내용을 채팅에 출력한다.**

- SQL 파일 생성 후 "Supabase SQL Editor에 아래 내용을 실행하세요" 와 함께 전체 SQL을 코드블록으로 띄울 것
- 사용자가 직접 실행해야 하므로 내용을 숨기지 않을 것

## 스크린샷 규칙

**preview_screenshot은 사용자에게 먼저 허가를 받고 찍는다.**

- 필요하다고 느껴도 자동으로 찍지 않을 것
- "스크린샷 찍어도 될까요?" 라고 먼저 물어볼 것
- 사용자가 명시적으로 허가한 경우에만 실행

<!-- VERCEL BEST PRACTICES START -->
## Best practices for developing on Vercel

These defaults are optimized for AI coding agents (and humans) working on apps that deploy to Vercel.

- Treat Vercel Functions as stateless + ephemeral (no durable RAM/FS, no background daemons), use Blob or marketplace integrations for preserving state
- Edge Functions (standalone) are deprecated; prefer Vercel Functions
- Don't start new projects on Vercel KV/Postgres (both discontinued); use Marketplace Redis/Postgres instead
- Store secrets in Vercel Env Variables; not in git or `NEXT_PUBLIC_*`
- Provision Marketplace native integrations with `vercel integration add` (CI/agent-friendly)
- Sync env + project settings with `vercel env pull` / `vercel pull` when you need local/offline parity
- Use `waitUntil` for post-response work; avoid the deprecated Function `context` parameter
- Set Function regions near your primary data source; avoid cross-region DB/service roundtrips
- Tune Fluid Compute knobs (e.g., `maxDuration`, memory/CPU) for long I/O-heavy calls (LLMs, APIs)
- Use Runtime Cache for fast **regional** caching + tag invalidation (don't treat it as global KV)
- Use Cron Jobs for schedules; cron runs in UTC and triggers your production URL via HTTP GET
- Use Vercel Blob for uploads/media; Use Edge Config for small, globally-read config
- If Enable Deployment Protection is enabled, use a bypass secret to directly access them
- Add OpenTelemetry via `@vercel/otel` on Node; don't expect OTEL support on the Edge runtime
- Enable Web Analytics + Speed Insights early
- Use AI Gateway for model routing, set AI_GATEWAY_API_KEY, using a model string (e.g. 'anthropic/claude-sonnet-4.6'), Gateway is already default in AI SDK
  needed. Always curl https://ai-gateway.vercel.sh/v1/models first; never trust model IDs from memory
- For durable agent loops or untrusted code: use Workflow (pause/resume/state) + Sandbox; use Vercel MCP for secure infra access
<!-- VERCEL BEST PRACTICES END -->

## 모바일 우선 코딩 규칙

새 컴포넌트/페이지 작성 또는 기존 코드 수정 시 반드시 준수:

### 필수 규칙
1. **패딩**: `p-6` 이상은 반드시 `p-4 md:p-6` 형태로 (모바일 먼저)
2. **그리드**: `grid-cols-3` 이상은 반드시 `grid-cols-2 md:grid-cols-3` 이상으로
3. **터치 타깃**: 클릭/탭 가능한 요소는 `min-h-[44px]` 이상 확보
4. **테이블**: 5열 이상 테이블은 `md:hidden` 카드 뷰 + `hidden md:block` 테이블 쌍으로
5. **고정 너비 금지**: `w-[NNNpx]` 대신 `max-w-[NNNpx] w-full` 사용
6. **가로 넘침**: 넘칠 가능성 있는 컨테이너에 `overflow-x-auto` 추가
7. **모달**: `p-4` 안전 여백 + `max-h-[90vh] overflow-y-auto`
8. **텍스트**: `text-[10px]` 이하 금지 (보조 정보는 `text-xs` = 12px 최소)

### 공통 Wrapper 컴포넌트 사용
- `PageContainer`: 페이지 최상위 패딩 컨테이너 (`p-4 md:p-7`)
- `ResponsiveGrid`: 반응형 그리드 (`cols={{ base:2, md:4 }}` 등)
