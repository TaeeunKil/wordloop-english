export type ClozePart = { kind: "text" | "blank"; value: string };

function isWordCharacter(value: string | undefined) {
  return Boolean(value && /[A-Za-z0-9]/.test(value));
}

/** Masks the first standalone occurrence of a term without revealing it in the prompt. */
export function makeClozeParts(sentence: string, term: string): { parts: ClozePart[]; matched: boolean } {
  const source = sentence.trim();
  const target = term.trim();
  if (!source || !target) return { parts: [{ kind: "text", value: source }], matched: false };

  const lowerSource = source.toLocaleLowerCase();
  const lowerTarget = target.toLocaleLowerCase();
  let from = 0;
  let index = -1;
  while (from < source.length) {
    const candidate = lowerSource.indexOf(lowerTarget, from);
    if (candidate < 0) break;
    const before = source[candidate - 1];
    const after = source[candidate + target.length];
    if (!isWordCharacter(before) && !isWordCharacter(after)) {
      index = candidate;
      break;
    }
    from = candidate + target.length;
  }

  if (index < 0) return { parts: [{ kind: "text", value: source }], matched: false };
  return {
    parts: [
      { kind: "text", value: source.slice(0, index) },
      { kind: "blank", value: source.slice(index, index + target.length) },
      { kind: "text", value: source.slice(index + target.length) },
    ],
    matched: true,
  };
}
