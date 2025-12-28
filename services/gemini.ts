
import { GoogleGenAI } from "@google/genai";

const MODEL_NAME = 'gemini-2.5-flash-image';
const SUGGESTION_MODEL = 'gemini-3-flash-preview';

export class ZixError extends Error {
  constructor(public message: string, public action?: string, public code?: string) {
    super(message);
    this.name = 'ZixError';
  }
}

export const editImageWithGemini = async (
  base64Image: string,
  prompt: string
): Promise<{ imageUrl: string; text: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const base64Data = base64Image.split(',')[1] || base64Image;
  const mimeType = base64Image.match(/data:([^;]+);/)?.[1] || 'image/png';

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    if (response.candidates?.[0]?.finishReason === 'SAFETY') {
      throw new ZixError(
        "Content safety filters triggered.",
        "Please rephrase your prompt to be more compliant.",
        "SAFETY"
      );
    }

    let newImageUrl = '';
    let responseText = '';

    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          newImageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        } else if (part.text) {
          responseText += part.text;
        }
      }
    }

    if (!newImageUrl) {
      throw new ZixError(
        "No image returned by the engine.",
        "Try making your instruction more descriptive.",
        "EMPTY_RESPONSE"
      );
    }

    return { imageUrl: newImageUrl, text: responseText };
  } catch (error: any) {
    console.error("Gemini Edit Error:", error);
    if (error instanceof ZixError) throw error;

    const apiError = error.message || "";
    
    if (apiError.includes("403") || apiError.includes("permission")) {
      throw new ZixError(
        "API access denied.",
        "Ensure your API key is from a paid project with billing enabled.",
        "AUTH"
      );
    }
    
    if (apiError.includes("429") || apiError.includes("quota")) {
      throw new ZixError(
        "Rate limit exceeded.",
        "Wait a moment and try again, or check your quota limits.",
        "QUOTA"
      );
    }

    if (apiError.includes("NetworkError") || apiError.includes("Failed to fetch")) {
      throw new ZixError(
        "Network connection interrupted.",
        "Check your internet connection and try again.",
        "NETWORK"
      );
    }

    throw new ZixError(
      "An unexpected processing error occurred.",
      "Check the system instructions or try a simpler prompt.",
      "UNKNOWN"
    );
  }
};

export const getDynamicSuggestions = async (base64Image: string): Promise<string[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64Data = base64Image.split(',')[1] || base64Image;
  const mimeType = base64Image.match(/data:([^;]+);/)?.[1] || 'image/png';

  try {
    const response = await ai.models.generateContent({
      model: SUGGESTION_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: "Analyze this image and provide 4 extremely short, creative, and highly specific image editing suggestions (max 3 words each). Return ONLY the suggestions as a simple comma-separated list.",
          },
        ],
      },
    });

    const text = response.text || "";
    return text.split(',')
      .map(s => s.trim().replace(/^["']|["']$/g, ''))
      .filter(s => s.length > 0 && s.length < 40)
      .slice(0, 4);
  } catch (error) {
    console.error("Suggestion Error:", error);
    return [];
  }
};
