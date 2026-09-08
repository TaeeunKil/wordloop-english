# 0002 — Shared sense catalog before onboarding

Status: implemented catalog foundation; onboarding and recommendation/session changes deferred.

## Decision

Use shared, original sense cards and an internal L1–L7 editorial difficulty scale. A card's difficulty describes the content; personal mastery remains in `review_state`. A target track describes what a learner wants to prepare for, not what they have already mastered. Changing a future target must preserve learned words, review events and due dates.

| Level | Label | Editorial CEFR band | Preparation guidance, not score equivalence |
| --- | --- | --- | --- |
| L1 | 생활 기초 | A1–A2 | Everyday objects/actions; foundation |
| L2 | 일상 확장 | A2 | Requests, movement, schedules; foundation |
| L3 | 중급 연결 | B1 | Reasons and experiences; TOEIC 750 foundation |
| L4 | 중상급 준비 | B1–B2 | Compare information; TOEIC 750 core / 900 preparation |
| L5 | 고급 핵심 | B2 | Evidence, arguments, workplace precision; DET 120+ and TOEIC 900 core |
| L6 | 고급 확장 | B2–C1 | Inference, nuance and abstract relationships; stretch |
| L7 | 정교한 표현 | C1–C2 | Formal, precise or specialized expression; optional extension |

Bands overlap intentionally. L6 anchors at C1 but includes B2 material as a bridge; L7 anchors at C1 and does not certify every card as C2. Difficulty belongs to a particular sense and learning context. The 175 starter cards plus 175 exp1 additions form a 350-card editorial set (50 per level), not a complete exam syllabus or independently calibrated CEFR word list.

## Exam guidance

The [official DET CEFR explanation](https://blog.englishtest.duolingo.com/duolingo-test-aligned-with-cefr/) places scores 100–125 in B2 and 130–150 in C1. DET 120 is toward the upper end of its B2 score band; “upper B2” is descriptive, not a separate official category. WordLoop uses L5 as a preparation default and L6 as stretch. The official score bands apply to the full test, not to our cards or vocabulary-only performance.

The [ETS TOEIC mapping](https://www.ets.org/pdfs/toeic/toeic-mapping-cefr-reference.pdf) gives section-specific recommended minima: B1 listening/reading 275/275, B2 400/385, C1 490/455. A total score alone can conceal an uneven skill profile. WordLoop's TOEIC 750 and 900 tracks are editorial preparation choices, not a conversion of those totals to CEFR. Source references checked 2026-09-08.

Do not reuse the earlier proposed L1–L7 numerical TOEIC/DET conversion ranges: those were unvalidated estimates. The stored display guidance instead identifies preparation targets and, where useful, clearly attributed official CEFR score bands. Onboarding must label this as “학습 방향 참고 · 공식 점수 환산 아님”; do not show a predicted score, guarantee, or progress-derived score. All stored guidance has `guidance_is_heuristic=true`.

## Starter track rules

| Track | Core | Stretch | Optional |
| --- | --- | --- | --- |
| DET 120+ | L5 (50 cards) | L6 (50) | Other levels (250) |
| TOEIC 750 | L3–L4 (100) | L5 (50) | Other levels (200) |
| TOEIC 900 | L4–L5 (100) | L6 (50) | Other levels (200) |

General/academic domains get a modest DET boost; workplace gets a TOEIC boost. Core/stretch/optional base priorities are 80/50/10 with a 10-point domain boost. Base weights are 1/.35/.1 with a 1.2 domain multiplier. These are deterministic initial rules, not measured exam frequency, probabilities, or percentages of a daily session. They can be refined per sense in later migrations as reviewed content grows.

The 350 English examples and Korean glosses were composed for this project, with no proprietary Duolingo/Malhae Boka lists or copied dictionary definitions. Provenance records AI-assisted editorial creation and lack of independent calibration; the expansion uses version `exp1` and new `wl-exp1-` keys. A single forward-only migration adds the 175 cards and their 525 rules without modifying existing data, bringing rule coverage to 1,050. Tests reject duplicate normalized term/meaning pairs across both batches. `LicenseRef-WordLoop-Original` identifies original project content; it is not an SPDX standard license, a claim of third-party permission, or a new public redistribution license. External content must carry its own verified license and source before ingestion. Frequency remains NULL until a real corpus source is supplied.

## Future daily session contract

Build a queue in this priority order: due review → recent mistakes → fresh personal cards → unseen track core → bounded stretch. Deduplicate by personal card/catalog sense across overlapping categories; an overdue mistake is one item. Existing `submit_review` rejects not-yet-due repeated reviews, so mistake selection must honor `due_at`. A new targeted-practice mode would require a separate explicit decision.

At session start, atomically select/import any new catalog cards and snapshot the ordered queue into future `study_session_items`, including reason and expected word/state versions. Reuse the snapshot on resume and refresh; concurrent starts must not create competing queues. Snapshot prompts or invalidate stale items deliberately when a personal card is edited. Use the learner's timezone when adding a future daily identity; the current session schema does not yet define one session per calendar day. A future goal change affects the next session's new selections, not an in-progress snapshot or review history.

Enforce the daily cap, prioritize due work, cap new/stretch introductions, and fill shortages from permitted categories. If the track is exhausted, show that state or offer extra due practice; do not silently promote an L5 learner to L7. Onboarding, user learning profiles, import/recommendation RPCs, automatic daily selection and stored session items are outside this change. Existing `study_queue()` still serves up to 20 due/fresh personal words.

## Verification boundary

Execute migrations plus synthetic authorization and review regressions with `tests/catalog.test.ts`. Embedded PostgreSQL verifies SQL behavior without Docker but does not verify hosted Supabase permissions, API schema cache or OAuth. No production database mutation is part of this implementation task.
