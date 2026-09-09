# ADR-0007: sentence meaning and per-word mastery

## Status

Accepted — 2026-09-09

## Context

WordLoop shows an English sentence with one target expression hidden. The word gloss alone is not enough to understand the exercise, while a shared catalog must not be mutated by one learner's results. We also need a simple, visible answer to “how well do I know this word?” without confusing that answer with either the spaced-repetition schedule or the adaptive level used to choose new cards.

## Decision

- Store the full Korean translation of a catalog example in `vocabulary_catalog.example_meaning`.
- Copy that value into the personal `words.example_meaning` snapshot when a catalog card is imported. Custom words can supply it later from the word editor.
- Show the sentence meaning in the initial study prompt. Keep `words.meaning` as the word/sense gloss shown in the hint and answer feedback.
- Store a per-user `review_state.mastery_score` from 0 to 100. Update it in the same security-definer transaction as the review event:

| Evidence | Change |
| --- | ---: |
| typed, correct, no hint | +15 |
| typed, correct, with hint | +7 |
| choice, correct | +5 |
| typed, incorrect | -20 |
| self-rated `good` / `again` | +3 / -12 |

Values are clamped to 0–100. The first state is shown as “평가 전” until the word has at least one review. The wordbook displays the score and a short status label at 30, 60, and 85 points.

## Rationale

This keeps the product model legible: `example_meaning` explains the sentence, `meaning` explains the target word, `mastery_score` describes personal memory stability, `stage` controls when the next review is due, and `user_ability` chooses the difficulty of future catalog cards. Only personal tables change during learning, so two users can practice the same catalog card independently.

The 1,050 initial sentence translations are generated from the original catalog by `scripts/generate-example-meanings.mjs` and committed as a forward-only data migration. They are a machine-translated first pass and are intentionally documented as editorially reviewable rather than presented as authoritative translations.

## Consequences

- The catalog and word snapshots gain one text field and the catalog search vector includes it.
- Review events contain mastery before/after/delta snapshots for debugging and future calibration.
- The study client can render a mastery result immediately, while the wordbook can render the persisted score for every personal word.
- Any future score calibration must be a new migration or versioned rule change; existing review history remains auditable.
