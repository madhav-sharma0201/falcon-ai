// Aptitude round — modelled on the pre-technical screening used by Indian
// mass recruiters (TCS NQT, Infosys, Wipro, Accenture, Capgemini): multiple
// choice, tight per-question timers, three sections.
//
// Unlike the hr/technical prompts this one emits `options` + `answerIndex`,
// which lets the server grade without an LLM call per answer.

const SECTIONS = {
  quantitative: [
    "Percentages, profit and loss, discount",
    "Ratio and proportion, partnership",
    "Time and work, pipes and cisterns",
    "Time, speed and distance, boats and streams",
    "Simple and compound interest",
    "Averages, mixtures and alligation",
    "Permutations, combinations and probability",
    "Number system, HCF and LCM",
    "Mensuration and basic geometry",
  ],
  logical: [
    "Series completion (number and letter)",
    "Coding and decoding",
    "Blood relations",
    "Direction sense",
    "Seating arrangement",
    "Syllogisms",
    "Puzzles and arrangements",
    "Data interpretation from a small table or chart",
    "Statement and conclusion",
  ],
  verbal: [
    "Synonyms and antonyms",
    "Sentence correction and grammar",
    "Fill in the blanks (prepositions, articles, tenses)",
    "Para jumbles",
    "Reading comprehension (short passage)",
    "Spotting errors",
  ],
};

const list = (items) => items.map((t) => `- ${t}`).join("\n");

// 6 is not arbitrary: solving the questions properly costs ~4.5k reasoning
// tokens, and Groq's free tier allows 8k/minute. More questions per call runs
// out of budget mid-reasoning and returns nothing at all.
const aptitudePrompt = ({ role, questionCount = 6 }) => `
You are an aptitude test setter for Indian campus placement exams.

Generate EXACTLY ${questionCount} multiple-choice aptitude questions.

Return VALID JSON only.

Candidate Role: ${role || "General"}

The role is context only. Aptitude questions are NOT role specific — do not
ask programming, framework or domain questions here. This is the pre-technical
screening round every candidate sits regardless of role.

=========================
SECTION MIX
=========================

Split the questions evenly across these three sections, in this order:

1. quantitative
${list(SECTIONS.quantitative)}

2. logical
${list(SECTIONS.logical)}

3. verbal
${list(SECTIONS.verbal)}

Pick a DIFFERENT topic for each question. Do not repeat a topic.

=========================
HOW TO BUILD EACH QUESTION (FOLLOW THIS ORDER)
=========================

STEP 1. Write the question.
STEP 2. SOLVE IT COMPLETELY and compute the final answer.
STEP 3. Write that computed answer into "answerValue".
STEP 4. Build the 4 options, and make sure "answerValue" is EXACTLY one of
        them, character for character.
STEP 5. Set "answerIndex" to the position of "answerValue" in "options".

Do NOT invent the options before solving. If you write options first and then
discover the real answer is not among them, the question is broken and will be
discarded. If your computed answer is not in your options, FIX THE OPTIONS.

=========================
RULES
=========================

1. Each question must have EXACTLY 4 options.
2. Exactly ONE option is correct.
3. "answerIndex" is the 0-based index of the correct option (0, 1, 2 or 3).
4. Vary which index is correct — do NOT make it 0 every time.
4b. "options[answerIndex]" must equal "answerValue" exactly.
4c. Never write a note like "not listed" or "oops" in the explanation. If you
    are tempted to, the options are wrong — correct them instead.
5. Every question must be solvable with pen and paper in the given time.
   No question may need a calculator, outside data, or current affairs.
6. The question text must be fully self-contained. If it needs a passage,
   table or figure, include that inline in the question text.
7. Options must be plausible. Wrong options should reflect realistic
   mistakes (a common wrong formula, a sign slip), not obvious nonsense.
8. "explanation" must show the working in 1-3 short sentences, so a
   candidate who got it wrong can learn the method.
9. Numeric options must be unambiguous — no "both A and B" style options.

=========================
DIFFICULTY AND TIMERS
=========================

difficulty must be exactly one of: easy, medium, hard

Aim for a spread of roughly one third easy, half medium, the rest hard.
Do not make every question the same difficulty.

timer is in SECONDS and must reflect real exam pressure:

- easy    : 45-60
- medium  : 60-90
- hard    : 90-120

Do NOT give every question the same timer.

=========================
OUTPUT
=========================

Return ONLY a JSON array. No markdown. No commentary.

"timer" and "answerIndex" must be JSON NUMBERS (75, not "75", never a word
like "seventy-five"). All other fields are strings.

[
  {
    "question": "A shopkeeper marks an item 40% above cost and gives a 25% discount. What is the profit percentage?",
    "options": ["5%", "10%", "15%", "20%"],
    "answerValue": "5%",
    "answerIndex": 0,
    "category": "quantitative",
    "difficulty": "medium",
    "timer": 75,
    "explanation": "Let cost be 100. Marked price is 140. After 25% discount the selling price is 105. Profit is 5 on 100, so 5%."
  }
]
`;

export default aptitudePrompt;
