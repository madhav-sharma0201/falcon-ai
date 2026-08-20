// Aptitude grading. Deliberately contains no LLM calls: an MCQ has one right
// answer, so grading it with a model would be slower, cost tokens against the
// per-minute budget, and occasionally be wrong about arithmetic.

const SECTION_LABEL = {
  quantitative: "Quantitative Aptitude",
  logical: "Logical Reasoning",
  verbal: "Verbal Ability",
};

/**
 * Resolve whatever the client sent into an option index.
 * Accepts the index ("2") or the exact option text, so the API stays usable
 * from both the UI and a raw client.
 * Returns -1 when nothing matches (unanswered / timed out).
 */
export const resolveAnswerIndex = (answer, options = []) => {
  if (answer === null || answer === undefined) return -1;

  const raw = String(answer).trim();
  if (!raw) return -1;

  if (/^[0-3]$/.test(raw)) return Number(raw);

  const byText = options.findIndex(
    (o) => String(o).trim().toLowerCase() === raw.toLowerCase()
  );
  return byText;
};

/**
 * Build the feedback sub-document for one answered MCQ.
 * Only `correctness` carries meaning for aptitude — clarity, creativity and
 * the rest are free-text dimensions and stay at 0 so they can't skew the
 * dashboard averages.
 */
export const gradeAptitudeAnswer = (question, answer) => {
  const chosen = resolveAnswerIndex(answer, question.options);
  const correct = chosen === question.answerIndex;
  const correctText = question.options?.[question.answerIndex] ?? "";

  const verdict = correct
    ? "Correct."
    : chosen === -1
    ? `Not answered. The correct answer is "${correctText}".`
    : `Incorrect. The correct answer is "${correctText}".`;

  return {
    correct,
    chosenIndex: chosen,
    feedback: {
      score: correct ? 100 : 0,
      correctness: correct ? 100 : 0,
      clarity: 0,
      relevance: 0,
      detail: 0,
      efficiency: 0,
      communication: 0,
      problemSolving: 0,
      creativity: 0,
      feedback: question.explanation ? `${verdict} ${question.explanation}` : verdict,
      improvements: [],
    },
  };
};

/**
 * Final report, computed from the answered questions rather than generated.
 * Per-section accuracy is something a summary model would only be guessing at.
 */
export const buildAptitudeReport = (questions = []) => {
  const total = questions.length;
  const correctCount = questions.filter((q) => q.feedback?.correctness === 100).length;
  const overallScore = total ? Math.round((correctCount / total) * 100) : 0;

  const bySection = {};
  for (const q of questions) {
    const key = q.category || "quantitative";
    bySection[key] = bySection[key] || { total: 0, correct: 0 };
    bySection[key].total += 1;
    if (q.feedback?.correctness === 100) bySection[key].correct += 1;
  }

  const sections = Object.entries(bySection).map(([key, s]) => ({
    key,
    label: SECTION_LABEL[key] || key,
    ...s,
    pct: s.total ? Math.round((s.correct / s.total) * 100) : 0,
  }));

  const strong = sections.filter((s) => s.pct >= 70).sort((a, b) => b.pct - a.pct);
  const weak = sections.filter((s) => s.pct < 50).sort((a, b) => a.pct - b.pct);

  // Name the actual topics missed — far more actionable than "practise more".
  const missedTopics = [
    ...new Set(
      questions
        .filter((q) => q.feedback?.correctness !== 100)
        .map((q) => SECTION_LABEL[q.category] || q.category)
        .filter(Boolean)
    ),
  ];

  const recommendations = [];
  for (const s of weak) {
    recommendations.push(
      `Focus on ${s.label} — you scored ${s.correct}/${s.total}. Drill this section daily before attempting a full mock.`
    );
  }
  if (!weak.length && overallScore < 100) {
    recommendations.push(
      "Your accuracy is solid across sections. Work on speed next — attempt full-length timed papers."
    );
  }
  if (overallScore === 100) {
    recommendations.push(
      "Full marks. Move to harder papers and tighten your per-question time."
    );
  }
  if (missedTopics.length) {
    recommendations.push(
      `Review the worked explanations for every question you missed in: ${missedTopics.join(", ")}.`
    );
  }

  const sectionLine = sections
    .map((s) => `${s.label} ${s.correct}/${s.total}`)
    .join(", ");

  const verdict =
    overallScore >= 80
      ? "That is comfortably above the cut-off most mass recruiters use."
      : overallScore >= 60
      ? "That is around the typical cut-off — tighten the weaker sections to be safe."
      : "That is below the cut-off most mass recruiters apply, so this round needs work.";

  return {
    overallScore,
    summary: `You answered ${correctCount} of ${total} correctly (${overallScore}%). ${sectionLine}. ${verdict}`,
    strengths: strong.length
      ? strong.map((s) => `${s.label} — ${s.correct}/${s.total} correct`)
      : ["No section reached 70% yet — treat every section as a priority."],
    weaknesses: weak.length
      ? weak.map((s) => `${s.label} — only ${s.correct}/${s.total} correct`)
      : ["No section fell below 50%."],
    recommendations,
    sections,
  };
};
