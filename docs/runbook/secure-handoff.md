# Secure handoff

이 문서는 새 PC나 다른 코딩 에이전트가 WordLoop 개발을 이어받을 때의 경계를 정리합니다. GitHub에는 코드와 재현 가능한 DB migration을 두고, 실제 운영 설정과 학습 데이터는 Supabase·Vercel에 남깁니다.

## GitHub에 올릴 것

- `src/`, `tests/`, `supabase/migrations/`, `public/`
- `README.md`, `SECURITY.md`, `AGENTS.md`, `docs/`
- `.env.example`, `supabase/config.toml`, `package.json`과 lockfile
- 개인 데이터가 없는 테스트와 문서

Migration은 파일명 순서가 곧 적용 순서입니다. 이미 적용한 파일을 수정하지 말고 새 migration을 추가합니다. `supabase/catalog/`의 공개·자체 editorial 원본은 구조·중복·비밀정보 검사를 거친 뒤 커밋할 수 있습니다. 현재 `expansion-v2`는 555개(L1~L5)의 원본이며, DB에 자동 반영되지 않습니다. 활성화하려면 품질 검토 후 stable key와 함께 별도의 forward-only migration으로 승격해야 합니다.

## GitHub에 올리지 않을 것

- `.env.local`과 Vercel 환경변수의 실제 값
- Supabase service-role/secret key와 OAuth client secret
- access token, refresh token, JWT, 브라우저 쿠키, Vercel token
- 사용자 계정, 단어장, 복습 이벤트, DB dump, 운영 백업
- 개인 정보가 포함된 로그·스크린샷·로컬 snapshot
- 개인정보·출처가 확인되지 않은 후보 콘텐츠
- `.vercel/`, `supabase/.temp/`, `node_modules/`, build 산출물

`.gitignore`가 보호하더라도 커밋 전에 파일 목록을 직접 확인합니다. 비밀값은 다른 에이전트 프롬프트나 공개 이슈에 붙이지 말고, 필요한 경우 사용자가 각 대시보드의 환경변수 입력란에 직접 넣습니다.

## 새 클론에서 시작하기

```text
git clone https://github.com/TaeeunKil/wordloop-english.git
cd wordloop-english
npm install
copy .env.example .env.local
```

`.env.local`에는 다음 세 값만 앱 연결에 필요합니다.

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
```

값은 기존 Supabase 프로젝트와 Vercel 환경에서 확인합니다. 클론에는 운영 프로젝트의 실제 값이나 연결 상태가 포함되지 않으므로, 값이 없으면 새로 발급하거나 운영자에게 설정을 요청해야 합니다.

## Supabase 인수인계 항목

1. 같은 Supabase 프로젝트인지 확인합니다. `supabase/config.toml`의 이름만으로 hosted project 연결을 증명하지 않습니다.
2. `supabase/migrations/` 전체가 순서대로 적용됐는지 확인합니다.
3. Authentication에서 Google·GitHub provider, provider secret, redirect allow-list를 확인합니다.
4. Provider의 callback은 `https://<project-ref>.supabase.co/auth/v1/callback`, 앱의 callback은 `<site-origin>/auth/callback` 형식을 사용합니다.
5. 두 계정으로 로그인해 한 계정의 단어와 복습 기록이 다른 계정에 보이지 않는지 확인합니다.

실제 RLS·OAuth 동작은 SQL 파일을 읽는 것만으로 검증되지 않습니다. hosted Preview/Production에서 인증된 smoke test를 수행하고 결과를 운영자의 비공개 기록에 남깁니다.

## Vercel 인수인계 항목

- GitHub 저장소와 연결된 Vercel project인지 확인합니다.
- Preview와 Production에 세 환경변수가 모두 등록됐는지 확인합니다.
- `NEXT_PUBLIC_SITE_URL`이 현재 배포 origin과 일치하는지 확인합니다.
- Supabase Auth redirect URL에 Preview/Production origin이 허용됐는지 확인합니다.
- 환경변수를 바꾼 뒤 새 배포가 실행됐는지 확인합니다.

Vercel project ID, team 권한, domain, deployment history, 환경변수 값은 GitHub clone에서 복원되지 않습니다.

## 커밋·배포 전 확인

```text
npm run check:repo
npm run check:env
npm run lint
npm run typecheck
npm test
npm run build
```

`check:env`는 실제 환경변수가 설정된 경우에만 연결 형식을 확인합니다. 이 명령이 통과해도 OAuth 로그인과 hosted DB 권한까지 보장하는 것은 아니므로, 최초 연결 시 실제 계정으로 별도 확인합니다.

## 비밀값이 노출됐을 때

1. 노출된 provider credential을 즉시 revoke/rotate합니다.
2. Supabase·Vercel의 값을 새 값으로 교체하고 재배포합니다.
3. GitHub Actions, 로컬 로그, 브라우저 저장소에 같은 값이 남았는지 확인합니다.
4. 영향 범위와 회복 시점을 공개 저장소가 아닌 운영자 기록에 남깁니다.

GitHub 파일에서 문자열만 삭제하는 것으로는 이전 커밋의 노출이 해결되지 않습니다. 자격증명 회전이 먼저이며, history 정리는 별도 판단과 백업 후 진행합니다.
