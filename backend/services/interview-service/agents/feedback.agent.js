import llm from "../configs/llm.js";
import feedbackPrompt from "../prompts/feedback.prompt.js";

export default async function feedbackAgent(data) {

  const prompt = feedbackPrompt(data);

  const response = await llm.invoke(prompt);

  try {

    const cleaned = response.content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(cleaned);

  } catch (error) {

    console.log("========== Feedback Agent Parse Error ==========");
    console.log(response.content);
    console.log("===============================================");

    throw new Error("Failed to generate feedback.");

  }

}