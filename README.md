# WordLoop

나만의 영어 단어를 저장하고, 직접 떠올리고, 다시 만나는 작은 학습 앱입니다.

WordLoop는 개인 학습 기록을 안전하게 보관하는 독립 앱입니다. GitHub 블로그에는 앱 링크만 두고, 학습 데이터는 Supabase PostgreSQL에 저장합니다. 배포 대상은 Vercel입니다.

## Stack

- Next.js App Router + TypeScript
- Supabase Auth (Google + GitHub OAuth) + PostgreSQL/RLS
- Vercel
- Vitest, Playwright 기반 검증

## Local development

```bash
npm install
copy .env.example .env.local
npm run dev
```

로컬 Supabase를 쓰려면 Docker와 Supabase CLI를 설치한 뒤 `npm run db:start`, `npm run db:reset`을 사용합니다. 클라우드 프로젝트는 [Supabase 설정 가이드](docs/runbook/supabase-setup.md)를 참고하세요.

검증 명령은 `npm run verify`입니다. 환경변수가 없는 CI에서도 코드 검증은 실행되며, 실제 로그인·데이터베이스 동작은 연결된 Supabase 프로젝트에서 확인해야 합니다.

## Repository map

- `src/`: Next.js 앱, 서버 액션, 데이터 접근
- `supabase/migrations/`: 스키마, RLS, 복습/통계 RPC
- `supabase/catalog/`: DB migration으로 승격하기 전의 버전 관리된 공용 단어 원본
- `docs/`: 설계, 운영, 이관, 학습 기록 문서
- `archive/legacy/`: 이전 정적 구현의 로컬 보존본. 새 앱 런타임에는 포함하지 않음
- `AGENTS.md`: 에이전트 작업 규칙

## Deployment

1. Supabase 프로젝트를 만들고 migration을 적용합니다.
2. Auth에서 Google과 GitHub provider 및 callback URL을 설정합니다.
3. Vercel에 이 저장소를 import합니다.
4. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`을 Vercel 환경변수로 등록합니다.

자세한 순서는 `docs/runbook/deployment.md`와 [보안 인수인계 가이드](docs/runbook/secure-handoff.md)에 있습니다. 비밀키는 커밋하지 말고, Supabase service-role key를 브라우저나 Vercel 공개 환경변수에 넣지 않습니다.

## Study contract

직접 입력·객관식 응답은 정답 여부를 서버에서 계산합니다. 문제에는 예문 전체 뜻을 보여주고, 단어 뜻은 힌트에서 확인합니다. `review_events`는 append-only 기록이고 `review_state`는 복습 일정과 단어별 0–100 숙련도를 담습니다. 두 변경과 사용자별 adaptive ability 갱신은 `submit_review` RPC 안에서 한 트랜잭션으로 처리하며, 클라이언트 재시도는 응답 ID 멱등성으로 중복 기록을 막습니다.
