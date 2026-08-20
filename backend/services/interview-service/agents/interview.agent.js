import llm, { aptitudeLlm } from "../configs/llm.js";
import hrInterviewPrompt from "../prompts/hrInterviewPrompt.js";
import technicalInterviewPrompt from "../prompts/technicalInterviewPrompt.js";
import aptitudePrompt from "../prompts/aptitude.prompt.js";

const VALID_CATEGORIES = ["quantitative", "logical", "verbal"];
const VALID_DIFFICULTY = ["easy", "medium", "hard"];

// MCQ questions are graded by comparing an index, with no LLM in the loop, so
// a malformed answerIndex would silently mark correct answers wrong. Anything
// that doesn't validate is dropped rather than trusted.
const validateAptitude = (questions) => {
  const clean = [];

  for (const q of questions) {
    if (!q || typeof q.question !== "string" || !q.question.trim()) continue;

    const options = Array.isArray(q.options)
      ? q.options.map((o) => String(o).trim()).filter(Boolean)
      : [];
    if (options.length !== 4) continue;

    // Duplicate options make "the correct one" ambiguous.
    if (new Set(options.map((o) => o.toLowerCase())).size !== 4) continue;

    const idx = Number(q.answerIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx > 3) continue;

    // Cross-check: the model states its computed answer separately, so if it
    // built the options before solving (and the real answer isn't among them)
    // the two disagree and we drop the question. Structural checks alone
    // can't catch a question whose "correct" option is simply wrong.
    if (q.answerValue !== undefined && q.answerValue !== null) {
      const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, " ");
      if (norm(q.answerValue) !== norm(options[idx])) continue;
    }

    // A model that noticed its own mistake mid-explanation left the question
    // broken; these markers are a reliable tell.
    if (/\b(oops|not listed|none of the above|correction:)\b/i.test(q.explanation || "")) continue;

    const timer = Number(q.timer);

    clean.push({
      question: q.question.trim(),
      options,
      answerIndex: idx,
      category: VALID_CATEGORIES.includes(q.category) ? q.category : "quantitative",
      difficulty: VALID_DIFFICULTY.includes(q.difficulty) ? q.difficulty : "medium",
      timer: Number.isFinite(timer) && timer >= 30 && timer <= 180 ? Math.round(timer) : 75,
      explanation: typeof q.explanation === "string" ? q.explanation.trim() : "",
    });
  }

  return clean;
};

export default async function interviewAgent(data) {
  const type = data.type?.toLowerCase();

  const prompt =
    type === "aptitude"
      ? aptitudePrompt(data)
      : type === "hr"
      ? hrInterviewPrompt(data)
      : technicalInterviewPrompt(data);

  const response = await (type === "aptitude" ? aptitudeLlm : llm).invoke(prompt);

  let parsed;
  try {
    const cleaned = response.content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    parsed = JSON.parse(cleaned);
  } catch (error) {
    console.log("Interview Agent Parse Error");
    console.log(response.content);

    throw new Error("Failed to generate interview questions.");
  }

  if (type !== "aptitude") return parsed;

  const questions = validateAptitude(Array.isArray(parsed) ? parsed : parsed?.questions || []);

  // Six are requested and the checks above may drop one or two. Below four
  // it stops being a meaningful test, so fail rather than serve a stub.
  if (questions.length < 4) {
    console.log(`Aptitude validation kept only ${questions.length} questions`);
    throw new Error("Failed to generate valid aptitude questions.");
  }

  return questions;
}
