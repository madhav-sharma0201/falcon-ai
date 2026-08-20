import dotenv from "dotenv";
dotenv.config();

import { ChatGroq } from "@langchain/groq";

const llm = new ChatGroq({
  model: "openai/gpt-oss-120b",
  reasoningFormat: "hidden",
  reasoningEffort: "low",
  temperature: 0.2,
  maxTokens: 4000,
  maxRetries: 2,
});

// Groq bills `max_tokens` against the per-minute budget as *requested* tokens,
// whether or not they are used. Generating a roadmap makes two calls back to
// back: the roadmap agent genuinely needs ~4k, but the resource agent only
// returns one short article URL per module. Reserving 4k for it too pushed
// each request to ~9.1k against an 8k/min free-tier limit, so the resource
// step failed every single time and roadmaps came back with no links at all.
export const resourceLlm = new ChatGroq({
  model: "openai/gpt-oss-120b",
  reasoningFormat: "hidden",
  reasoningEffort: "low",
  temperature: 0.2,
  maxTokens: 1200,
  maxRetries: 2,
});

export default llm;