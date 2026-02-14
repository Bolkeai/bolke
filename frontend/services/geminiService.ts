import { GoogleGenAI, Type } from "@google/genai";
import { AIAction } from "../types";

// const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const SYSTEM_INSTRUCTION = `
You are the brain of 'BolkeAI', a voice-first grocery app for India.
Your goal is to understand the user's voice transcript (in Hindi, English, or Hinglish) and map it to a specific structured action.
The user might ask to search for items, add items to cart, view cart, or checkout.

Output purely JSON.

Available Actions (type):
1. SEARCH: User wants to see products. Extract the search term into 'query'.
2. ADD_TO_CART: User wants to buy something specific. Extract 'productName', 'quantity' (default 1), and 'provider' if mentioned (Zepto/Blinkit).
3. SHOW_CART: User wants to see their current cart.
4. CHECKOUT: User wants to place the order.
5. UNKNOWN: If the input is not related to shopping.

Field 'speakResponse':
Generate a short, warm, natural response in the same language/style as the user (Hindi/English mix is good).
Keep it under 10 words.
Examples: "Here are some fresh tomatoes.", "Added 1kg onions to your cart.", "The cart is ready."
`;

export const parseUserIntent = async (transcript: string): Promise<AIAction> => {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("No API Key found. Using mock response.");
    if (transcript.toLowerCase().includes("cart")) {
      return { type: 'SHOW_CART', speakResponse: "Here is your cart." };
    }
    if (transcript.toLowerCase().includes("checkout") || transcript.toLowerCase().includes("order")) {
      return { type: 'CHECKOUT', speakResponse: "Proceeding to checkout." };
    }
    return {
      type: 'SEARCH',
      query: transcript,
      speakResponse: `Searching for ${transcript}`
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: transcript,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ['SEARCH', 'ADD_TO_CART', 'SHOW_CART', 'CHECKOUT', 'UNKNOWN'] },
            query: { type: Type.STRING },
            productName: { type: Type.STRING },
            quantity: { type: Type.NUMBER },
            provider: { type: Type.STRING, enum: ['Zepto', 'Blinkit', 'Instamart'] },
            speakResponse: { type: Type.STRING }
          },
          required: ['type', 'speakResponse']
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini");
    return JSON.parse(text) as AIAction;

  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      type: 'UNKNOWN',
      speakResponse: "Maaf kijiye, main samajh nahi paaya. Phir se boliye?"
    };
  }
};
