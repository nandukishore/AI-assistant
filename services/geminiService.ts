
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GEMINI_QA_SYSTEM_PROMPT, GEMINI_MODEL_NAME } from '../constants';

let ai: GoogleGenAI | null = null;

const getGenAI = (): GoogleGenAI => {
  if (!ai) {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY environment variable not set.");
    }
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return ai;
};

export async function* generateAnswerStream(question: string): AsyncIterable<GenerateContentResponse> {
  try {
    const genAI = getGenAI();
    const stream = await genAI.models.generateContentStream({
      model: GEMINI_MODEL_NAME,
      contents: question, // User's question
      config: {
        systemInstruction: GEMINI_QA_SYSTEM_PROMPT,
        thinkingConfig: { thinkingBudget: 0 } // For gemini-2.5-flash-preview-04-17 to reduce latency
      }
    });
    
    for await (const chunk of stream) {
      yield chunk;
    }

  } catch (error) {
    console.error("Error generating answer stream from Gemini:", error);
    if (error instanceof Error) {
        throw new Error(`Gemini API stream error: ${error.message}`);
    }
    throw new Error("An unknown error occurred while streaming an answer from Gemini.");
  }
}