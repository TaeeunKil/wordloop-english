# Security notes

## 저장소에 포함할 수 있는 것

- 앱 코드, 테스트, 설계 문서, 운영 절차, Supabase의 forward-only migration
- 실제 값이 비어 있는 `.env.example`
- 공개해도 되는 Supabase publishable key의 변수명과 callback URL 형식

## 커밋하지 않는 것

- `.env.local`, Vercel 환경변수의 실제 값, Supabase service-role/secret key
- Google/GitHub OAuth client secret, access token, refresh token, 브라우저 쿠키와 JWT
- Supabase 사용자·단어장·복습 기록, 데이터베이스 dump와 운영 백업
- 개인 정보가 포함된 로그, 캡처, 로컬 recovery snapshot
- 개인정보·출처가 확인되지 않은 후보 데이터와 운영 데이터

`.env*`, `*.pem`, `*.key`, `.vercel/`, `supabase/.temp/`와 같은 로컬 산출물은 Git에서 제외합니다. `.env.example`만 예외적으로 추적합니다.

`supabase/catalog/`는 개인 정보가 없는 WordLoop 자체 editorial 원본만 커밋할 수 있습니다. 커밋된 원본도 검토와 forward-only migration 없이 hosted DB의 활성 콘텐츠가 되지는 않습니다.

## 런타임 경계

- 브라우저에는 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`만 사용합니다. service-role/secret key는 서버와 관리 화면 밖으로 내보내지 않습니다.
- 모든 사용자 소유 테이블은 `user_id`와 RLS로 보호하고, 비공개 페이지와 서버 action은 `requireUser()`로 세션을 확인합니다.
- 복습 결과의 정답 여부는 클라이언트 값을 믿지 않고 `submit_review` RPC가 서버에서 계산합니다.
- 단어 수정은 version을 비교하는 optimistic concurrency로 처리합니다.
- 공유 단어 카탈로그도 authenticated read 정책을 통과해야 하며, 일반 사용자에게 관리용 쓰기 권한을 주지 않습니다.

## 커밋 전 확인

```text
npm run check:repo
npm run lint
npm run typecheck
npm test
npm run build
```

이 검사는 저장소와 정적 동작을 확인합니다. 실제 Supabase RLS, OAuth, Vercel 환경변수 연결은 설정된 Preview/Production에서 별도 smoke test를 해야 합니다.

## 유출 대응

비밀값이 노출되면 GitHub에서 지우는 것만으로 끝나지 않습니다. 해당 provider에서 즉시 revoke/rotate하고, Vercel 환경변수를 갱신한 뒤 재배포합니다. 운영 데이터가 저장소에 들어갔다면 공개 이슈에 내용을 복사하지 말고 저장소 운영자에게 먼저 알립니다.

문제를 발견하면 저장소 이슈 대신 개인 저장소 운영자에게 먼저 알려주세요.
