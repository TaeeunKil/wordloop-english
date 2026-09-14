# ADR-0008: semantic mastery color scale

## Status

Superseded — 2026-09-14 by ADR-0009. The original four-band structure remains useful, but its traffic-light-like palette was replaced after visual and design-system review.

## Context

WordLoop already stores each learner's word mastery as a clamped score from 0 to 100 and shows four Korean status labels. The wordbook currently renders filled mastery dots with one accent color, while the dashboard experiment initially used a black meter to avoid decorative color. Both extremes lose useful information: a single color is slow to scan, but arbitrary color variation would make the learning surface noisy and could confuse low mastery with an error state.

The color system must remain separate from the following concepts:

- `mastery_score`: the learner's accumulated per-word practice signal
- `stage` / `due_at`: when the word should be reviewed next
- `user_ability`: the learner-wide parameter used to select future difficulty
- correctness feedback: whether the current answer was correct

## Decision

Use the existing mastery-label boundaries as the single source of truth for a semantic four-band color scale. An unreviewed word has no mastery band and stays neutral.

| State | Score / evidence | UI label | Color token | Hex | Meaning |
| --- | --- | --- | --- | --- | --- |
| Unreviewed | `reviews = 0` | `아직 평가 전` | `--mastery-unreviewed` | `#e1dbd0` | No evidence yet; do not imply zero ability |
| Low | `0–29` after a review | `아직 익숙하지 않음` | `--mastery-low` | `#a84d3a` | Needs repeated recall |
| Developing | `30–59` | `익숙해지는 중` | `--mastery-developing` | `#876a2c` | Some recall evidence is present |
| Established | `60–84` | `기억이 자리 잡는 중` | `--mastery-established` | `#387265` | Recall is becoming stable |
| Stable | `85–100` | `안정적으로 기억 중` | `--mastery-stable` | `#235b4e` | Strong personal practice signal, not permanent mastery |

The score and status label remain visible wherever the colored meter or dots appear. Color is a scanning aid, never the only status channel. Low mastery uses a muted terracotta distinct from the CTA and is not presented as a validation error. The CTA keeps the brand accent `--accent`; answer correctness keeps `--success` / `--danger` where applicable.

## Application plan

1. **Centralize the rule:** move the existing `masteryLabel` boundaries and a new `masteryBand` helper into a shared `src/lib/mastery.ts`. Keep the database score and review algorithm unchanged.
2. **Expose semantics in the wordbook:** add the band as a data attribute on the mastery dot bar. Filled dots receive the band token; empty dots remain neutral. Keep `aria-valuetext` as `score / 100 · label`.
3. **Align other surfaces:** use the same tokens in any dashboard or study feedback mastery meter. Do not color the adaptive-level meter, review due state, or answer result with mastery colors.
4. **Keep the experiment honest:** the standalone dashboard mockup uses the same boundaries and token values. It remains fictional and has no production data or persistence.
5. **Review after real use:** observe whether four hues improve finding weak words without adding noise. If not, reduce saturation before reducing the semantic bands; do not silently redefine score thresholds.

## Accessibility and visual rules

- Text, score, and status label must remain readable without color vision.
- The band colors are chosen to reach at least 3:1 contrast against the neutral meter track for non-text graphical indicators; text uses the normal ink color.
- Do not add a legend to every row. The label carries the meaning and the design document is the reference for the tokens.
- Preserve visible keyboard focus and `prefers-reduced-motion`; color changes must not be required to understand a state transition.
- The system uses one semantic family, not a rainbow scale. Do not add a fifth “perfect” color or a gradient.

## Verification plan

- Unit-test boundaries at 0, 29, 30, 59, 60, 84, 85, and 100, plus the unreviewed state.
- Render the wordbook at 320px, 390px, and desktop widths and confirm dots do not overflow or collapse into an unreadable line.
- Check that `aria-valuetext` and visible labels match the band for every score.
- Check that the CTA, answer feedback, review scheduling, database values, and adaptive ability behavior are unchanged.
- Run the repository's normal verification suite after implementation; this ADR itself requires no migration or production database change.

## Consequences

This adds a small semantic color vocabulary but makes the existing mastery model faster to scan. It also creates a visual contract that must be shared by the wordbook, dashboard, and any future study summary. The trade-off is that four muted hues add more visual variation than the current single accent; keeping them confined to mastery indicators and pairing them with text limits that cost.
