# Security notes

- 브라우저에는 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`만 노출합니다.
- service-role/secret key를 클라이언트 코드, `.env.example`, 로그, 커밋에 넣지 않습니다.
- 모든 사용자 테이블은 `user_id`와 RLS를 사용합니다.
- 복습 결과는 클라이언트가 보낸 정답 여부를 믿지 않고 `submit_review`가 서버에서 계산합니다.
- 단어 수정은 version을 비교하는 optimistic concurrency로 처리합니다.
- 공개 블로그에는 학습 데이터나 Supabase 자격증명을 넣지 않습니다.

문제를 발견하면 저장소 이슈 대신 개인 저장소 운영자에게 먼저 알려주세요.
