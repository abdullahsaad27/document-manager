import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { getSettings } from './settingsService';
import { ApiLimitError } from './aiService';

// Initialize the Gemini client based on user settings or environment variables
const getGeminiClient = (apiKey?: string): GoogleGenAI => {
    const settings = getSettings();
    const key = apiKey || settings.googleApiKey;

    // Fix: process.env is not available in Vite client-side code (except via define)
    // Use import.meta.env instead.
    const finalKey = key || import.meta.env.VITE_API_KEY;

    if (!finalKey) {
        throw new ApiLimitError("Google API key is not configured. Please add it in Settings or as an environment variable.");
    }
    return new GoogleGenAI({ apiKey: finalKey });
};

// Core function to interact with the Gemini API
const generateGeminiContent = async (
    contents: any,
    config?: any
): Promise<GenerateContentResponse> => {
    try {
        const ai = getGeminiClient();
        const settings = getSettings();
        const model = settings.model || 'gemini-3-flash-preview';

        const response = await ai.models.generateContent({
            model: model,
            contents,
            config
        });
        return response;
    } catch (err) {
        console.error("Gemini Service Error:", err);
        const message = err instanceof Error ? err.message : 'An unknown error occurred with the Google AI service.';
        if (message.includes('API key not valid') || message.includes('quota')) {
            throw new ApiLimitError(message);
        }
        throw new Error(message);
    }
};

// Generates simple text content
export const generateText = async (prompt: string): Promise<string> => {
    const response = await generateGeminiContent(prompt);
    return response.text;
};

// Generates JSON content based on a schema
export const generateJson = async (prompt: string, schema: any): Promise<string> => {
    const response = await generateGeminiContent(prompt, {
        responseMimeType: "application/json",
        responseSchema: schema
    });
    return response.text;
};

// Handles multi-modal requests with a single image
export const generateMultiModalText = async (prompt: string, imagePart: any): Promise<string> => {
    const contents = { parts: [imagePart, { text: prompt }] };
    const response = await generateGeminiContent(contents);
    return response.text;
};

// Handles multi-modal requests with multiple images
export const generateMultiModalTextFromImages = async (prompt: string, imageParts: any[]): Promise<string> => {
    const parts: any[] = [{ text: prompt }, ...imageParts];
    const contents = { parts };
    const response = await generateGeminiContent(contents);
    return response.text;
};

// Verifies if a user-provided Google API key is valid
export const verifyGoogleApiKey = async (apiKey: string): Promise<boolean> => {
    try {
        const ai = getGeminiClient(apiKey);
        await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: 'test',
        });
        return true;
    } catch (e) {
        console.error("Google API Key verification failed:", e);
        return false;
    }
};