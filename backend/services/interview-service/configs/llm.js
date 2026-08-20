import dotenv from "dotenv"
dotenv.config()
import { ChatGroq } from "@langchain/groq";

const llm = new ChatGroq({
    model: "openai/gpt-oss-120b",
  reasoningFormat: "hidden",
  reasoningEffort: "low",
      temperature: 0.2,
  maxRetries: 2,
})

// Aptitude questions are arithmetic, not recall: the model has to actually
// solve each one before it can write the options. At reasoningEffort "low" it
// produced questions whose correct answer wasn't among the four choices.
// Lower temperature too — there's a right answer here, creativity is a defect.
// Measured on gpt-oss-120b: 6 questions at "medium" burns ~4.5k reasoning
// tokens before emitting any JSON, finishing around 6.6k total. At maxTokens
// 4000 the whole budget went to reasoning and the response came back empty
// (finish_reason: "length"), so this headroom is required, not padding.
export const aptitudeLlm = new ChatGroq({
  model: "openai/gpt-oss-120b",
  reasoningFormat: "hidden",
  reasoningEffort: "medium",
  temperature: 0,
  maxTokens: 6500,
  maxRetries: 2,
})

export default llm