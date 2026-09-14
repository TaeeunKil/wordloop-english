# ADR-0009: terracotta mastery progression

## Status

Proposed — 2026-09-14. Revised after visual review; the production application is not changed yet.

## Context

ADR-0008 established four mastery bands but used red, dark yellow, teal, and dark teal. That reads like a traffic-light status system: red suggests danger, yellow suggests warning, and green suggests success. Those meanings are appropriate for system states, but a learner's low mastery is not an error and high mastery is not a final success state. The palette also competed with WordLoop's single terracotta action color.

The review followed three design-system principles:

- [W3C WCAG 2.2 — Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color): color may reinforce information, but text or another visual cue must carry the meaning as well.
- [Atlassian — Data visualization color](https://atlassian.design/foundations/color-new/data-visualization-color/): status/severity colors should be used for status meaning, and additional indicators are needed because users may not distinguish hues reliably.
- [Radix Colors — Semantic aliases](https://www.radix-ui.com/colors/docs/overview/aliasing): semantic aliases should describe the role of a color, rather than casually reusing a hue such as yellow for unrelated meanings.

## Decision proposal

Keep the existing score boundaries and labels, but replace the traffic-light palette with a single terracotta progression. The visual movement is from a very light brand tint to WordLoop's existing terracotta point color. Low mastery is deliberately quiet rather than a warning, and stable mastery does not become a green “success” state. The scale reuses existing heatmap and accent tokens instead of introducing a new hue family.

| State | Score / evidence | Visible label | Token | Hex | Role |
| --- | --- | --- | --- | --- | --- |
| Unreviewed | `reviews = 0` | `아직 평가 전` | `--mastery-unreviewed` | `#e1dbd0` | Neutral; no evidence is not the same as zero ability |
| Low | `0–29` after a review | `아직 익숙하지 않음` | `--mastery-low` | `#f0cfc4` | Light heat tint; subdued and not an error accent |
| Developing | `30–59` | `익숙해지는 중` | `--mastery-developing` | `#e6a895` | Light terracotta; practice is beginning to settle |
| Established | `60–84` | `기억이 자리 잡는 중` | `--mastery-established` | `#da7e68` | Clear terracotta; the memory signal is becoming stronger |
| Stable | `85–100` | `안정적으로 기억 중` | `--mastery-stable` | `#d45b3d` | WordLoop point color; strong practice signal, not permanent mastery |

The colors are applied only to filled mastery dots or non-text meter bars. The score and Korean status label remain visible in every context. `--accent` remains reserved for primary actions, active navigation, and contribution heatmap intensity. `--success` and `--danger` remain reserved for answer/system outcomes and are not reused for mastery.

This is a categorical four-band scale, not a CSS gradient. The score fill length communicates quantity; the increasingly visible terracotta communicates the status label at a glance. No legend is added to each row, and no extra color is assigned to a “perfect” state.

## Implementation plan

1. Add the four mastery tokens to the shared design tokens in `src/app/globals.css`.
2. Move the existing score boundaries and label logic from `src/components/word-editor.tsx` into a shared `src/lib/mastery.ts` helper that returns both `masteryLabel` and `masteryBand`.
3. Add `data-mastery-band` to the wordbook's mastery dot bar and style only filled dots with the corresponding token. Keep empty dots on `--surface-strong`.
4. Reuse the same helper and tokens in the dashboard experiment and any future study summary. Do not color `user_ability`, `due_at`, or answer correctness with mastery tokens.
5. Review the result after real use. If four tints still feel busy, reduce the number of visible bands before introducing another hue; do not change score boundaries without a new decision record.

## Accessibility and verification

- The label, score, and `aria-valuetext` must remain sufficient without color perception.
- The lightest mastery tint is intentionally subtle, so the bar is never the only cue: the score, visible status label, and accessible value text carry the meaning. The stronger three fills are visually distinct from the neutral track; contrast and color-vision checks must be run on the final meter/dot treatment.
- Verify boundaries at 0, 29, 30, 59, 60, 84, 85, and 100, plus the unreviewed state.
- Render 320px, 390px, and desktop wordbook views and check that the dots remain readable and do not overflow.
- Preserve visible focus and `prefers-reduced-motion`; color is not required to understand an interaction.

## Consequences

The scale is less immediately “game-like” than red/yellow/green, but it avoids labeling ordinary learning progress as danger or success. It gives WordLoop a recognizable, calm visual language while making the strongest mastery state visibly belong to the same brand family as the action that matters: starting practice.
