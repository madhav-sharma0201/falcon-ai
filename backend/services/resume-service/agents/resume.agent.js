import llm from "../configs/llm.js";
import {
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";

const resumeAgent = async (resumeText) => {

  const response = await llm.invoke([

    new SystemMessage(`
You are an Expert ATS Resume Analyzer.

Analyze the given resume.

Extract the following information:

- Full Name
- Email
- Phone Number
- Professional Summary
- Technical Skills
- Projects
- Education
- Experience
- Strengths
- Weaknesses
- Missing Skills
- Suggested Job Role
- ATS Score (0-100)
- Recommendations

IMPORTANT RULES:

1. Return ONLY valid JSON.
2. Do not use markdown.
3. Do not explain anything.
4. Do not add extra text.
5. Every field must exist.
6. All array fields (skills, projects, education, experience, strengths,
   weaknesses, missingSkills, recommendations) must be arrays of PLAIN
   STRINGS. Never use objects or nested arrays inside them. Flatten any
   structured detail into a single readable sentence per item.
   Example: "education": ["B.Tech Computer Science, VIT, 2026, CGPA 8.6"]

Response Format:

{
  "name":"",
  "email":"",
  "phone":"",
  "summary":"",
  "skills":[],
  "projects":[],
  "education":[],
  "experience":[],
  "strengths":[],
  "weaknesses":[],
  "missingSkills":[],
  "suggestedRole":"",
  "score":0,
  "recommendations":[]
}
`),

    new HumanMessage(resumeText),

  ]);

  return response.content;
};

export default resumeAgent;