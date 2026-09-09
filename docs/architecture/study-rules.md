# Study rules

- A new active word is due immediately.
- Typed answers are normalized for leading/trailing ASCII whitespace, repeated ASCII whitespace, and case. Punctuation remains meaningful.
- Correct typed answers without a hint advance the stage and schedule intervals of 1, 3, 7, 14, 30, 60, and 120 days.
- A wrong answer, a hint-assisted answer, or a self-rated `again` returns in ten minutes. Hint-assisted and self-rated answers do not advance the stage.
- Every response has a client-generated UUID. Repeating the exact request returns the original receipt; reusing its UUID with different content is rejected.
- The server calculates typed/choice correctness. Self-rating is explicitly recorded as a self-assessment.
- Shared card difficulty is fixed. A per-user 0–1000 ability score maps to L1–L7 and selects new cards around the current level; direct typed answers carry the most evidence, hints and choices carry less, and self-ratings do not change ability.
