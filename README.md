# WordLoop — English Recall Trainer

Markdown 파일로 단어를 관리하고, 직접 회상과 간격 반복으로 영어 단어를 익히는 작은 학습 앱입니다. DET, TOEFL, TOEIC 또는 일반 영어 공부에 사용할 수 있습니다.

## 기능

- `words.md`의 단어 목록을 브라우저에서 읽음
- 보기 없이 답을 직접 입력하는 회상 문제 제공
- 문맥 → 영어 단어, 영단어 → 한국어 뜻, 한국어 뜻 → 영어 단어 모드 제공
- 4지선다 확인 모드는 보조 모드로 제공
- 단어별 암기 레벨 0~5 기록
- 힌트 없이 맞히면 레벨 +1, 힌트를 사용하면 레벨을 유지
- 오답이면 레벨 -1
- 레벨 5가 되지 않은 단어는 미확인 단어로 분류
- 오답 단어는 두 문제 뒤에 다시 출제
- 정답 후 10분, 1일, 3일, 7일, 14일 간격으로 복습
- 레벨이 낮거나 복습 시점이 지난 단어일수록 더 자주 출제
- 첫 글자·품사·영어 정의 힌트 제공
- 진행도는 브라우저의 `localStorage`에 저장
- 진행도를 JSON 파일로 내보내기 가능
- 별도 빌드 도구나 서버 없이 GitHub Pages에서 실행 가능

## 단어 추가 방법

`words.md`에 다음 형식으로 블록을 추가합니다.

```md
## word
- meaning: 한국어 뜻
- pos: part of speech
- definition: an English definition for a non-spoiling hint
- collocations: common word combinations
- example: The example sentence contains the word.
- example_ko: 예문 해석
```

문맥 속 회상 문제를 사용하려면 `example`에 해당 단어를 포함시키는 것이 좋습니다. `definition`과 `pos`를 입력하면 힌트 품질이 좋아집니다. 단어가 4개 이상 있어야 4지선다 확인 모드를 사용할 수 있습니다.

## 암기 레벨과 복습 간격

레벨은 단순 정답 횟수가 아니라 힌트 사용 여부와 시간 간격을 함께 반영합니다.

| 레벨 | 의미 | 기본 복습 간격 |
|---:|---|---:|
| 0 | 새 단어 또는 오답 | 10분 |
| 1 | 힌트 없이 1회 회상 | 10분 |
| 2 | 다음 단계 회상 | 1일 |
| 3 | 익숙한 상태 | 3일 |
| 4 | 거의 확인됨 | 7일 |
| 5 | 확인됨 | 14일 후 복습 |

힌트를 사용한 정답은 정답 기록에는 남지만 레벨을 올리지 않습니다. 이렇게 해야 보기를 보고 찍거나 힌트를 본 직후의 단기 기억이 완전 암기로 기록되지 않습니다.

## 실행 방법

파일을 직접 더블클릭하지 말고, 프로젝트 폴더에서 간단한 로컬 서버를 실행합니다.

```bash
python3 -m http.server 8000
```

그다음 브라우저에서 `http://localhost:8000`을 엽니다.

## GitHub Pages에 올리기

1. GitHub에서 새 저장소를 만듭니다. 예: `wordloop-english`
2. 이 폴더에서 아래 명령을 실행합니다.

```bash
git init
git add .
git commit -m "Add WordLoop English recall trainer"
git branch -M main
git remote add origin https://github.com/YOUR_ID/wordloop-english.git
git push -u origin main
```

3. GitHub 저장소의 `Settings → Pages`에서 `Deploy from a branch`를 선택합니다.
4. Branch는 `main`, 폴더는 `/ (root)`로 저장합니다.

잠시 후 생성된 GitHub Pages 주소에서 휴대폰과 PC로 사용할 수 있습니다.

## 점수 저장에 대한 참고

GitHub Pages는 정적 사이트이므로 기본 구현에서는 진행도를 현재 브라우저에 저장합니다. 다른 기기에서도 같은 진행도를 공유하려면 나중에 Firebase, Supabase 또는 GitHub 로그인 기반 저장 기능을 추가할 수 있습니다.
