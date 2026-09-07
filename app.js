const STORAGE_KEY = "det-vocab-progress-v1";

const LEVEL_NAMES = [
  "새로운 단어",
  "한 번 회상함",
  "아직 약함",
  "어느 정도 익숙함",
  "거의 확인됨",
  "확인됨",
];

// 정답을 맞힌 뒤 다음에 다시 볼 시점. 레벨 5가 되면 14일 뒤 복습한다.
const REVIEW_DELAYS_MINUTES = [10, 10, 1440, 4320, 10080, 20160];

const elements = {
  loadingState: document.querySelector("#loading-state"),
  errorState: document.querySelector("#error-state"),
  errorMessage: document.querySelector("#error-message"),
  quizContent: document.querySelector("#quiz-content"),
  completeState: document.querySelector("#complete-state"),
  totalCount: document.querySelector("#total-count"),
  pendingCount: document.querySelector("#pending-count"),
  sessionCount: document.querySelector("#session-count"),
  averageLevel: document.querySelector("#average-level"),
  modeLabel: document.querySelector("#mode-label"),
  questionCounter: document.querySelector("#question-counter"),
  focusLevel: document.querySelector("#focus-level"),
  quizHeading: document.querySelector("#quiz-heading"),
  questionText: document.querySelector("#question-text"),
  answerArea: document.querySelector("#answer-area"),
  answerInput: document.querySelector("#answer-input"),
  checkAnswerButton: document.querySelector("#check-answer-btn"),
  hintButton: document.querySelector("#hint-btn"),
  hintBox: document.querySelector("#hint-box"),
  options: document.querySelector("#options"),
  feedback: document.querySelector("#feedback"),
  feedbackTitle: document.querySelector("#feedback-title"),
  feedbackText: document.querySelector("#feedback-text"),
  nextButton: document.querySelector("#next-btn"),
  modeSelect: document.querySelector("#mode-select"),
  weakOnly: document.querySelector("#weak-only"),
  wordList: document.querySelector("#word-list"),
  reloadButton: document.querySelector("#reload-btn"),
  exportButton: document.querySelector("#export-btn"),
  resetButton: document.querySelector("#reset-btn"),
  reviewAllButton: document.querySelector("#review-all-btn"),
};

const state = {
  words: [],
  progress: loadProgress(),
  currentQuestion: null,
  retryQueue: [],
  sessionAnswered: 0,
  sessionCorrect: 0,
};

function loadProgress() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
  } catch {
    // Private browsing or a restricted browser may block localStorage.
  }
}

function blankProgress() {
  return {
    level: 0,
    correct: 0,
    wrong: 0,
    streak: 0,
    attempts: 0,
    hints: 0,
    lastReviewed: null,
    nextReviewAt: null,
  };
}

function progressFor(word) {
  const existing = state.progress[word.id] || {};
  const progress = { ...blankProgress(), ...existing };
  progress.level = Math.max(0, Math.min(5, Number(progress.level) || 0));
  progress.correct = Number(progress.correct) || 0;
  progress.wrong = Number(progress.wrong) || 0;
  progress.streak = Number(progress.streak) || 0;
  progress.attempts = Number(progress.attempts) || 0;
  progress.hints = Number(progress.hints) || 0;
  state.progress[word.id] = progress;
  return progress;
}

function normalizeKey(key) {
  return key.toLowerCase().replace(/[\s_-]/g, "");
}

function stripMarkdown(value) {
  return value
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .trim();
}

function slugify(value) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9가-힣]+/g, "-")
      .replace(/^-+|-+$/g, "") || "word"
  );
}

function parseWordsMarkdown(markdown) {
  const drafts = [];
  let current = null;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    const heading = line.match(/^##(?!#)\s+(.+?)\s*$/);

    if (heading) {
      if (current) drafts.push(current);
      current = { word: stripMarkdown(heading[1]), fields: {} };
      continue;
    }

    if (!current) continue;

    const field = line.match(/^[-*]\s+([^:]+):\s*(.*)$/);
    if (field) {
      current.fields[normalizeKey(field[1])] = stripMarkdown(field[2]);
    }
  }

  if (current) drafts.push(current);

  const usedIds = new Map();
  return drafts
    .map((draft) => {
      const fields = draft.fields;
      const word = draft.word;
      const baseId = slugify(word);
      const count = (usedIds.get(baseId) || 0) + 1;
      usedIds.set(baseId, count);

      return {
        id: count === 1 ? baseId : `${baseId}-${count}`,
        word,
        meaning:
          fields.meaning ||
          fields.뜻 ||
          fields.translation ||
          fields["한국어"] ||
          "뜻 정보 없음",
        definition: fields.definition || fields.영어정의 || "",
        pos: fields.pos || fields.품사 || "",
        collocations: fields.collocations || fields.연어 || "",
        example: fields.example || fields.예문 || "",
        exampleKo: fields.exampleko || fields.예문해석 || "",
      };
    })
    .filter((word) => word.word && word.meaning);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character];
  });
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

function normalizeAnswer(value) {
  return String(value)
    .toLocaleLowerCase("en-US")
    .replace(/[.,!?;:'"“”‘’`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactAnswer(value) {
  return normalizeAnswer(value).replace(/[^\p{L}\p{N}]/gu, "");
}

function weightedPick(words) {
  if (!words.length) return undefined;

  const now = Date.now();
  const weightedWords = words.map((word) => {
    const progress = progressFor(word);
    const nextReview = progress.nextReviewAt ? Date.parse(progress.nextReviewAt) : 0;
    const overdueBonus = nextReview && nextReview < now ? 4 : 0;
    return {
      word,
      weight: Math.max(1, (6 - progress.level) ** 2 + overdueBonus),
    };
  });
  const totalWeight = weightedWords.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.random() * totalWeight;

  for (const item of weightedWords) {
    cursor -= item.weight;
    if (cursor <= 0) return item.word;
  }

  return weightedWords.at(-1)?.word;
}

function isDue(word) {
  const nextReviewAt = progressFor(word).nextReviewAt;
  return !nextReviewAt || Date.parse(nextReviewAt) <= Date.now();
}

function activePool() {
  const queuedIds = new Set(state.retryQueue.map((item) => item.id));
  const availableWords = state.words.filter((word) => !queuedIds.has(word.id));
  const unconfirmed = availableWords.filter((word) => progressFor(word).level < 5);

  if (elements.weakOnly.checked) {
    const dueUnconfirmed = unconfirmed.filter(isDue);
    return dueUnconfirmed.length ? dueUnconfirmed : unconfirmed;
  }

  const dueWords = availableWords.filter(isDue);
  return dueWords.length ? dueWords : availableWords.length ? availableWords : state.words;
}

function replaceTargetWord(sentence, targetWord) {
  const escapedTarget = targetWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wordPattern = new RegExp(`(^|[^A-Za-z])${escapedTarget}(?=$|[^A-Za-z])`, "i");
  const replaced = sentence.replace(wordPattern, "$1_____");
  return replaced === sentence
    ? sentence.replace(new RegExp(escapedTarget, "i"), "_____")
    : replaced;
}

function createQuestion(target) {
  const mode = elements.modeSelect.value;

  if (mode === "multiple-choice") {
    const otherWords = shuffle(state.words.filter((word) => word.id !== target.id)).slice(0, 3);
    return {
      target,
      mode,
      answerKind: "choice",
      prompt: "문맥에 맞는 단어를 고르세요.",
      text: target.example
        ? replaceTargetWord(target.example, target.word)
        : `Choose the word that best matches: ${target.word}`,
      options: shuffle([target, ...otherWords]),
      hintUsed: false,
      answered: false,
    };
  }

  if (mode === "word-input") {
    return {
      target,
      mode,
      answerKind: "meaning",
      prompt: "이 영단어의 한국어 뜻을 직접 입력하세요.",
      text: target.word,
      hintUsed: false,
      answered: false,
    };
  }

  if (mode === "meaning-input") {
    return {
      target,
      mode,
      answerKind: "word",
      prompt: "이 뜻에 해당하는 영어 단어를 직접 입력하세요.",
      text: target.meaning,
      hintUsed: false,
      answered: false,
    };
  }

  return {
    target,
    mode: "context-input",
    answerKind: "word",
    prompt: "문맥 속 빈칸에 들어갈 영어 단어를 직접 입력하세요.",
    text: target.example
      ? replaceTargetWord(target.example, target.word)
      : target.definition || "예문을 words.md에 추가해 주세요.",
    hintUsed: false,
    answered: false,
  };
}

function levelName(level) {
  return LEVEL_NAMES[Math.max(0, Math.min(5, level))];
}

function formatReviewTime(progress) {
  if (!progress.nextReviewAt) return "지금 복습 가능";
  const remaining = Date.parse(progress.nextReviewAt) - Date.now();
  if (remaining <= 0) return "복습 필요";
  if (remaining < 60 * 60 * 1000) return `${Math.ceil(remaining / 60000)}분 후`;
  if (remaining < 24 * 60 * 60 * 1000) {
    return `${Math.ceil(remaining / (60 * 60 * 1000))}시간 후`;
  }
  return `${Math.ceil(remaining / (24 * 60 * 60 * 1000))}일 후`;
}

function renderStats() {
  const levels = state.words.map((word) => progressFor(word).level);
  const pending = levels.filter((level) => level < 5).length;
  const average = levels.length
    ? (levels.reduce((sum, level) => sum + level, 0) / levels.length).toFixed(1)
    : "-";

  elements.totalCount.textContent = state.words.length;
  elements.pendingCount.textContent = pending;
  elements.sessionCount.textContent = state.sessionAnswered;
  elements.averageLevel.textContent = levels.length ? `${average} / 5` : "-";
}

function renderWordList() {
  const sortedWords = [...state.words].sort((first, second) => {
    const levelDifference = progressFor(first).level - progressFor(second).level;
    if (levelDifference !== 0) return levelDifference;
    return Number(isDue(second)) - Number(isDue(first));
  });

  elements.wordList.innerHTML = sortedWords
    .map((word) => {
      const progress = progressFor(word);
      const level = progress.level;
      const segments = Array.from({ length: 5 }, (_, index) => {
        return `<span class="level-segment ${index < level ? "is-filled" : ""}></span>`;
      }).join("");

      return `
        <div class="word-row" title="${escapeHtml(levelName(level))}">
          <div>
            <div class="word-name">${escapeHtml(word.word)}</div>
            <div class="word-meaning">${escapeHtml(word.meaning)}</div>
            <div class="word-review">${escapeHtml(formatReviewTime(progress))}</div>
          </div>
          <span class="level-number">${level}</span>
          <div class="level-track" aria-label="레벨 ${level} / 5">${segments}</div>
        </div>
      `;
    })
    .join("");
}

function showOnly(view) {
  elements.loadingState.classList.toggle("is-hidden", view !== "loading");
  elements.errorState.classList.toggle("is-hidden", view !== "error");
  elements.quizContent.classList.toggle("is-hidden", view !== "quiz");
  elements.completeState.classList.toggle("is-hidden", view !== "complete");
}

function modeLabel(mode) {
  const labels = {
    "context-input": "문맥 → 단어 회상",
    "word-input": "단어 → 뜻 회상",
    "meaning-input": "뜻 → 단어 회상",
    "multiple-choice": "4지선다 확인",
  };
  return labels[mode] || "WordLoop";
}

function inputPlaceholder(question) {
  return question.answerKind === "meaning"
    ? "한국어 뜻을 입력하세요"
    : "영어 단어를 입력하세요";
}

function renderQuestion() {
  const question = state.currentQuestion;
  if (!question) return;

  const targetProgress = progressFor(question.target);
  elements.modeLabel.textContent = modeLabel(question.mode);
  elements.questionCounter.textContent = `이번 세션 ${state.sessionAnswered}문제`;
  elements.focusLevel.textContent = `현재 단어 레벨 ${targetProgress.level} / 5 · ${levelName(
    targetProgress.level,
  )}`;
  elements.quizHeading.textContent = question.prompt;
  elements.questionText.textContent = question.text;
  elements.feedback.classList.add("is-hidden");
  elements.hintBox.classList.add("is-hidden");
  elements.hintBox.textContent = "";
  elements.hintButton.disabled = false;

  const isChoice = question.mode === "multiple-choice";
  elements.answerArea.classList.toggle("is-hidden", isChoice);
  elements.options.classList.toggle("is-hidden", !isChoice);
  elements.answerInput.value = "";
  elements.answerInput.disabled = false;
  elements.checkAnswerButton.disabled = false;
  elements.answerInput.placeholder = inputPlaceholder(question);

  if (isChoice) {
    elements.options.innerHTML = question.options
      .map((word, index) => {
        const letter = String.fromCharCode(65 + index);
        return `
          <button class="option-button" type="button" data-word-id="${escapeHtml(word.id)}">
            <span class="option-letter">${letter}</span>
            <span class="option-label">${escapeHtml(word.word)}</span>
          </button>
        `;
      })
      .join("");

    elements.options.querySelectorAll(".option-button").forEach((button) => {
      button.addEventListener("click", () => submitChoice(button.dataset.wordId));
    });
  } else {
    elements.options.innerHTML = "";
    window.setTimeout(() => elements.answerInput.focus(), 0);
  }

  showOnly("quiz");
}

function getHintText(question) {
  const target = question.target;
  const firstLetter = target.word.charAt(0).toUpperCase();
  const length = [...target.word].length;
  const lines = [];

  if (target.pos) lines.push(`품사: ${target.pos}`);
  if (question.answerKind === "word") {
    lines.push(`첫 글자: ${firstLetter} · 글자 수: ${length}`);
    if (target.definition) lines.push(`영어 정의: ${target.definition}`);
  } else if (target.definition) {
    lines.push(`영어 정의: ${target.definition}`);
  } else {
    lines.push(`첫 글자: ${firstLetter} · 글자 수: ${length}`);
  }

  return lines.join("\n");
}

function showHint() {
  const question = state.currentQuestion;
  if (!question || question.answered) return;
  question.hintUsed = true;
  elements.hintBox.textContent = getHintText(question);
  elements.hintBox.classList.remove("is-hidden");
  elements.hintButton.disabled = true;
}

function meaningMatches(answer, meaning) {
  const normalizedAnswer = compactAnswer(answer);
  if (!normalizedAnswer) return false;

  const candidates = meaning
    .split(/[,/·;|]/)
    .map((candidate) => compactAnswer(candidate))
    .filter((candidate) => candidate.length >= 2);

  return candidates.some(
    (candidate) =>
      normalizedAnswer === candidate ||
      (normalizedAnswer.length >= 2 &&
        (candidate.includes(normalizedAnswer) || normalizedAnswer.includes(candidate))),
  );
}

function textAnswerIsCorrect(question, answer) {
  if (question.answerKind === "meaning") {
    return meaningMatches(answer, question.target.meaning);
  }
  return normalizeAnswer(answer) === normalizeAnswer(question.target.word);
}

function scheduleNextReview(progress, isCorrect, hintUsed) {
  const delayMinutes =
    !isCorrect || hintUsed
      ? REVIEW_DELAYS_MINUTES[0]
      : REVIEW_DELAYS_MINUTES[Math.min(progress.level, REVIEW_DELAYS_MINUTES.length - 1)];
  progress.nextReviewAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
}

function queueRetry(wordId) {
  state.retryQueue = state.retryQueue.filter((item) => item.id !== wordId);
  state.retryQueue.push({
    id: wordId,
    availableAfter: state.sessionAnswered + 2,
  });
}

function getRetryTarget() {
  const retryIndex = state.retryQueue.findIndex(
    (item) => item.availableAfter <= state.sessionAnswered,
  );
  if (retryIndex < 0) return undefined;

  const [retry] = state.retryQueue.splice(retryIndex, 1);
  return state.words.find((word) => word.id === retry.id);
}

function allOptionExplanations(question) {
  return question.options
    .map((word, index) => {
      const letter = String.fromCharCode(65 + index);
      return `${letter} ${word.word}: ${word.meaning}`;
    })
    .join("\n");
}

function expectedAnswerText(question) {
  return question.answerKind === "meaning"
    ? `${question.target.word} — ${question.target.meaning}`
    : question.target.word;
}

function buildFeedback(question, isCorrect, typedAnswer, progress, selectedWord) {
  const exampleLine = question.target.exampleKo
    ? `문장 해석: ${question.target.exampleKo}\n`
    : "";
  const collocationLine = question.target.collocations
    ? `자주 쓰는 표현: ${question.target.collocations}\n`
    : "";

  if (question.mode === "multiple-choice") {
    if (isCorrect) {
      return `${question.target.word}: ${question.target.meaning}\n${exampleLine}${collocationLine}전체 보기:\n${allOptionExplanations(
        question,
      )}`;
    }
    return `선택한 보기: ${selectedWord?.word || "알 수 없는 보기"} — ${
      selectedWord?.meaning || "뜻 정보 없음"
    }\n정답: ${question.target.word} — ${question.target.meaning}\n${exampleLine}${collocationLine}이 단어는 두 문제 뒤에 다시 출제됩니다.`;
  }

  if (isCorrect) {
    const hintMessage = question.hintUsed
      ? "힌트를 사용했으므로 레벨은 유지하고 짧은 간격으로 다시 봅니다."
      : "힌트 없이 회상했으므로 다음 단계로 이동합니다.";
    return `입력한 답: ${typedAnswer}\n${question.target.word}: ${question.target.meaning}\n${exampleLine}${collocationLine}${hintMessage}\n다음 복습: ${formatReviewTime(
      progress,
    )}`;
  }

  return `입력한 답: ${typedAnswer || "입력하지 않음"}\n정답: ${expectedAnswerText(
    question,
  )}\n${exampleLine}${collocationLine}두 문제 뒤에 같은 단어를 다시 회상합니다.`;
}

function finishAnswer({ isCorrect, typedAnswer = "", selectedWord = null }) {
  const question = state.currentQuestion;
  if (!question || question.answered) return;
  question.answered = true;

  const targetProgress = progressFor(question.target);
  targetProgress.attempts += 1;
  targetProgress.lastReviewed = new Date().toISOString();
  if (question.hintUsed) targetProgress.hints += 1;

  if (isCorrect) {
    targetProgress.correct += 1;
    targetProgress.streak += 1;
    if (!question.hintUsed) {
      targetProgress.level = Math.min(5, targetProgress.level + 1);
    }
    state.sessionCorrect += 1;
  } else {
    targetProgress.wrong += 1;
    targetProgress.streak = 0;
    targetProgress.level = Math.max(0, targetProgress.level - 1);
    queueRetry(question.target.id);
  }

  scheduleNextReview(targetProgress, isCorrect, question.hintUsed);
  state.sessionAnswered += 1;
  saveProgress();
  renderStats();
  renderWordList();

  if (question.mode === "multiple-choice") {
    elements.options.querySelectorAll(".option-button").forEach((button) => {
      button.disabled = true;
      if (button.dataset.wordId === question.target.id) {
        button.classList.add("is-correct");
      }
      if (selectedWord && button.dataset.wordId === selectedWord.id && !isCorrect) {
        button.classList.add("is-wrong");
      }
    });
  } else {
    elements.answerInput.disabled = true;
    elements.checkAnswerButton.disabled = true;
    elements.hintButton.disabled = true;
  }

  elements.feedbackTitle.textContent = isCorrect
    ? `정답입니다 · ${question.hintUsed ? "힌트 사용" : "무힌트 회상"} · 레벨 ${
        targetProgress.level
      } / 5`
    : `다시 확인이 필요해요 · 레벨 ${targetProgress.level} / 5`;
  elements.feedbackTitle.className = `feedback-title ${isCorrect ? "is-success" : "is-error"}`;
  elements.feedbackText.textContent = buildFeedback(
    question,
    isCorrect,
    typedAnswer,
    targetProgress,
    selectedWord,
  );
  elements.feedback.classList.remove("is-hidden");
}

function submitTypedAnswer() {
  const question = state.currentQuestion;
  if (!question || question.answered) return;
  const typedAnswer = elements.answerInput.value.trim();
  finishAnswer({
    isCorrect: textAnswerIsCorrect(question, typedAnswer),
    typedAnswer,
  });
}

function submitChoice(selectedId) {
  const question = state.currentQuestion;
  if (!question || question.answered) return;
  const selectedWord = question.options.find((word) => word.id === selectedId);
  finishAnswer({
    isCorrect: selectedId === question.target.id,
    selectedWord,
  });
}

function chooseNextTarget() {
  const retryTarget = getRetryTarget();
  if (retryTarget) return retryTarget;
  return weightedPick(activePool());
}

function nextQuestion() {
  if (state.words.length < 4) {
    showError("words.md에 문제를 만들 수 있는 단어가 4개 이상 필요합니다.");
    return;
  }

  const target = chooseNextTarget();
  if (!target) {
    showOnly("complete");
    elements.questionCounter.textContent = "모든 단어 확인 완료";
    return;
  }

  state.currentQuestion = createQuestion(target);
  renderQuestion();
}

function showError(message) {
  elements.errorMessage.textContent = message;
  showOnly("error");
}

async function loadWords() {
  showOnly("loading");
  try {
    const response = await fetch(`./words.md?cache=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const markdown = await response.text();
    state.words = parseWordsMarkdown(markdown);
    state.currentQuestion = null;
    state.retryQueue = [];
    state.sessionAnswered = 0;
    state.sessionCorrect = 0;
    renderStats();
    renderWordList();

    if (state.words.length < 4) {
      showError("words.md에 문제를 만들 수 있는 단어가 4개 이상 필요합니다.");
      return;
    }

    nextQuestion();
  } catch (error) {
    showError(`words.md를 불러오지 못했습니다. (${error.message})`);
  }
}

function exportProgress() {
  const payload = {
    exportedAt: new Date().toISOString(),
    words: state.words.map((word) => ({
      id: word.id,
      word: word.word,
      meaning: word.meaning,
      progress: progressFor(word),
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `det-vocab-progress-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function resetProgress() {
  const confirmed = window.confirm("모든 단어의 암기 레벨과 풀이 기록을 초기화할까요?");
  if (!confirmed) return;
  state.progress = {};
  state.sessionAnswered = 0;
  state.sessionCorrect = 0;
  state.retryQueue = [];
  saveProgress();
  renderStats();
  renderWordList();
  nextQuestion();
}

elements.nextButton.addEventListener("click", nextQuestion);
elements.checkAnswerButton.addEventListener("click", submitTypedAnswer);
elements.hintButton.addEventListener("click", showHint);
elements.answerInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") submitTypedAnswer();
});
elements.reloadButton.addEventListener("click", loadWords);
elements.exportButton.addEventListener("click", exportProgress);
elements.resetButton.addEventListener("click", resetProgress);
elements.modeSelect.addEventListener("change", () => {
  state.retryQueue = [];
  nextQuestion();
});
elements.weakOnly.addEventListener("change", () => {
  state.retryQueue = [];
  nextQuestion();
});
elements.reviewAllButton.addEventListener("click", () => {
  elements.weakOnly.checked = false;
  nextQuestion();
});

document.addEventListener("keydown", (event) => {
  const question = state.currentQuestion;
  if (!question || question.answered || question.mode !== "multiple-choice") return;
  const number = Number(event.key);
  if (number >= 1 && number <= 4) {
    const button = elements.options.querySelectorAll(".option-button")[number - 1];
    button?.click();
  }
});

loadWords();
