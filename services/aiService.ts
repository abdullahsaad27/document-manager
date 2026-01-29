import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { QuizQuestion, UserAnswer, QuizResult, StructuredContentItem, OpenRouterModel } from '../types';
import { getSettings } from './settingsService';
import * as geminiService from './geminiService';
import { logger } from './loggerService';

// Custom error for API limits
export class ApiLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiLimitError';
  }
}

const handleApiCall = async (
    prompt: string | any[], 
    model: string, 
    isJson: boolean = false, 
    schema?: any,
    filePart?: any
) => {
    const settings = getSettings();
    const startTime = Date.now();
    const actionType = filePart ? 'Multimodal/OCR' : 'Text Generation';
    const logId = `REQ-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    logger.info(`[${logId}] بدء طلب الذكاء الاصطناعي`, `Provider: ${settings.provider}, Model: ${model}, Type: ${actionType}`);
    console.log(`[AI Service] Starting handleApiCall. Provider: ${settings.provider}, Model: ${settings.model}, Action: ${filePart ? 'Multimodal/OCR' : 'Text'}`);

    try {
        let result;
        if (settings.provider === 'google') {
            console.log(`[AI Service] Calling Gemini Service...`);
            if (isJson) {
                result = await geminiService.generateJson(prompt as string, schema);
            } else if (filePart) {
                result = await geminiService.generateMultiModalText(prompt as string, filePart);
            } else {
                result = await geminiService.generateText(prompt as string);
            }
        } else if (['openai', 'openrouter', 'mistral'].includes(settings.provider)) {
            console.log(`[AI Service] Calling Server Data Proxy...`);
            const url = '/api/ai'; 
            
            const messages: any[] = [];
            let action = 'chat';

            if (settings.provider === 'mistral' && model === 'mistral-ocr-latest' && filePart) {
                action = 'ocr';
            }

            if (action === 'chat') {
                if (filePart) {
                    if (filePart.inlineData.mimeType.startsWith('image/')) {
                        messages.push({
                            role: 'user',
                            content: [
                                { type: 'text', text: prompt },
                                { type: 'image_url', image_url: { url: `data:${filePart.inlineData.mimeType};base64,${filePart.inlineData.data}` } }
                            ]
                        });
                    } else {
                        throw new Error(`Provider ${settings.provider} does not support direct file analysis for mime type ${filePart.inlineData.mimeType}.`);
                    }
                } else {
                    messages.push({ role: 'user', content: prompt });
                }
            }

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    provider: settings.provider, 
                    model: settings.model,
                    action,
                    messages: action === 'chat' ? messages : undefined,
                    fileData: action === 'ocr' ? filePart.inlineData.data : undefined,
                    fileMimeType: action === 'ocr' ? filePart.inlineData.mimeType : undefined,
                    userApiKey: settings.provider === 'mistral' ? settings.mistralApiKey : undefined,
                    ...(isJson && { response_format: { type: "json_object" } }),
                }),
            });

            const resBody = await res.json();
            if (!res.ok) {
                const errorMessage = resBody?.error?.message || resBody?.message || `API Error: ${res.status}`;
                console.error(`[AI Service] Server Proxy Error: ${errorMessage}`);
                if (res.status === 429 || res.status === 401) throw new ApiLimitError(errorMessage);
                throw new Error(errorMessage);
            }

            if (action === 'ocr') {
                if (!resBody.pages) throw new Error("استجابة غير صالحة من نموذج OCR.");
                result = resBody.pages.map((p: any) => p.markdown).join('\n\n');
            } else {
                result = resBody.choices[0].message.content;
            }
        } else {
            throw new Error("Unsupported AI provider.");
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        const resultSize = result?.length || 0;
        logger.success(`[${logId}] اكتمل الطلب بنجاح`, `Duration: ${duration}s, Output Size: ${resultSize} chars`);
        console.log(`[AI Service] handleApiCall success. Result length: ${result?.length}`);
        return result;

    } catch (err) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        
        logger.error(`[${logId}] فشل الطلب`, `Duration: ${duration}s, Error: ${errorMessage}`);
        
        if (err instanceof ApiLimitError) {
            throw err;
        }
        console.error("AI Service Error:", err);
        throw new Error(`خطأ في التواصل مع الذكاء الاصطناعي: ${errorMessage}`);
    }
};

const createChunks = (inputText: string, size: number): string[] => {
    const chunks: string[] = [];
    let i = 0;
    while (i < inputText.length) {
        let endIndex = Math.min(i + size, inputText.length);
        if (endIndex < inputText.length) {
            const lastParagraphBreak = inputText.lastIndexOf('\n\n', endIndex);
            if (lastParagraphBreak > i + size / 2) { 
                endIndex = lastParagraphBreak;
            }
        }
        chunks.push(inputText.substring(i, endIndex));
        i = endIndex;
    }
    return chunks;
};


export const summarizeText = async (
    text: string, 
    summaryType: string,
    setProgress?: (message: string) => void
): Promise<string> => {
    const settings = getSettings();
    
    setProgress?.('جاري إنشاء الملخص...');
    let prompt;
    
    if (summaryType.startsWith('TEMPLATE:')) {
        const customInstruction = summaryType.replace('TEMPLATE:', '');
        prompt = `${customInstruction}\n\nText to process:\n${text}`;
    } else {
        switch (summaryType) {
            case 'points':
                prompt = `Summarize the following text into key bullet points in Arabic:\n\n${text}`;
                break;
            case 'short':
                prompt = `Provide a short, one-paragraph summary of the following text in Arabic:\n\n${text}`;
                break;
            case 'detailed':
                prompt = `Provide an exhaustive and highly detailed summary of the following text in Arabic. Your goal is to create a summary so comprehensive that it could substitute for reading the original document. Capture all key arguments, data, narrative points, and conclusions. Structure the summary logically.\n\nText:\n---\n${text}\n---`;
                break;
            case 'simple':
                prompt = `Explain the following text in simple Arabic terms, as if for a beginner:\n\n${text}`;
                break;
            default:
                prompt = `Summarize the following text in Arabic:\n\n${text}`;
        }
    }
    const result = await handleApiCall(prompt, settings.model);
    return result.trim();
};

export const summarizeImages = async (imageParts: any[], summaryType: string): Promise<string> => {
    const settings = getSettings();
    let prompt;
    switch (summaryType) {
        case 'points':
            prompt = `This document is a series of images. Summarize its content into key bullet points in Arabic.`;
            break;
        case 'short':
            prompt = `This document is a series of images. Provide a short, one-paragraph summary of its content in Arabic.`;
            break;
        case 'detailed':
            prompt = `This document is a series of images. Provide a detailed summary of its content in Arabic, covering all main sections shown.`;
            break;
        case 'simple':
            prompt = `This document is a series of images. Explain its content in simple Arabic terms, as if for a beginner.`;
            break;
        default:
            prompt = `This document is a series of images. Summarize its content in Arabic.`;
    }

    try {
        if (settings.provider === 'google') {
            return await geminiService.generateMultiModalTextFromImages(prompt, imageParts);
        } else if (['openai', 'openrouter', 'mistral'].includes(settings.provider)) {
            const url = '/api/ai'; 
            
            const content: any[] = [{ type: 'text', text: prompt }];
            imageParts.forEach(part => {
                content.push({
                    type: 'image_url',
                    // FIX: Use 'part' instead of the non-existent 'filePart' variable inside the forEach iterator.
                    image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` }
                });
            });

            const messages = [{ role: 'user', content }];

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    provider: settings.provider,
                    model: settings.model,
                    messages,
                    userApiKey: settings.provider === 'mistral' ? settings.mistralApiKey : undefined,
                }),
            });
            
            const resBody = await res.json();
            if (!res.ok) {
                const errorMessage = resBody?.error?.message || `API Error: ${res.status}`;
                if (res.status === 429 || res.status === 401) throw new ApiLimitError(errorMessage);
                throw new Error(errorMessage);
            }

            return resBody.choices[0].message.content.trim();
        } else {
             throw new Error("Unsupported AI provider.");
        }
    } catch (err) {
        if (err instanceof ApiLimitError) throw err;
        console.error("AI Service Error (summarizeImages):", err);
        const message = err instanceof Error ? err.message : 'An unknown error occurred.';
        throw new Error(`An error occurred while communicating with the AI service: ${message}`);
    }
};

export const summarizeFileDirectly = async (filePart: any, summaryType: string): Promise<string> => {
    const settings = getSettings();
    
    if (settings.provider !== 'google' && !(settings.provider === 'mistral' && settings.model === 'mistral-ocr-latest')) {
        throw new Error(`مزود الخدمة '${settings.provider}' لا يدعم تحليل ملفات PDF مباشرة.`);
    }

    let prompt;
    if (summaryType.startsWith('TEMPLATE:')) {
        const customInstruction = summaryType.replace('TEMPLATE:', '');
        prompt = `This document is a file. Analyze its content (which may be text or images) and follow these instructions:\n${customInstruction}`;
    } else {
        switch (summaryType) {
            case 'points':
                prompt = `This document is a file. Analyze its content (which may be text or images) and summarize it into key bullet points in Arabic.`;
                break;
            case 'short':
                prompt = `This document is a file. Analyze its content (which may be text or images) and provide a short, one-paragraph summary of it in Arabic.`;
                break;
            case 'detailed':
                prompt = `This document is a file. Analyze its content (which may be text or images) and provide an exhaustive and highly detailed summary in Arabic. Your goal is to create a summary so comprehensive that it could substitute for reading the original document. Capture all key arguments, data, narrative points, and conclusions. Structure the summary logically.`;
                break;
            case 'simple':
                prompt = `This document is a file. Analyze its content (which may be text or images) and explain it in simple Arabic terms, as if for a beginner.`;
                break;
            default:
                prompt = `This document is a file. Analyze its content (which may be text or images) and summarize it in Arabic.`;
        }
    }

    const result = await handleApiCall(prompt, settings.model, false, undefined, filePart);
    return result.trim();
};

export const createQuiz = async (context: string, numQuestions: number, qType: string, customInstr: string): Promise<{ quiz: QuizQuestion[] }> => {
    const settings = getSettings();
    const instruction = `Based on the following context, create a quiz in Arabic with exactly ${numQuestions} questions.
    Question type should be: ${qType}.
    ${customInstr ? `Follow these custom instructions: ${customInstr}` : ''}
    For multiple-choice questions, provide 4 options.
    Return the response as a JSON object with a single key "quiz" which is an array of question objects.
    Each question object must have "type" ("multiple-choice", "true-false", or "open-ended"), "question", and for multiple-choice, an "options" array of strings.

    Context:
    ---
    ${context}
    ---
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            quiz: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        type: { type: Type.STRING },
                        question: { type: Type.STRING },
                        options: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                    },
                    required: ['type', 'question']
                }
            }
        },
    };

    const result = await handleApiCall(instruction, settings.model, true, schema);
    return JSON.parse(result);
};

export const correctQuiz = async (quiz: QuizQuestion[], userAnswers: UserAnswer): Promise<{ score: number; results: QuizResult[] }> => {
    const settings = getSettings();
    const data = {
        questions: quiz,
        answers: userAnswers
    };

    const instruction = `Correct the following quiz in Arabic based on the questions and user answers.
    Provide the correct answer for each question in Arabic.
    Determine if the user's answer was correct.
    Calculate a final score out of 100.
    Return a JSON object with "score" (a number) and "results" (an array).
    Each item in the results array should have "question", "userAnswer", "correctAnswer", and "isCorrect" (boolean).

    Quiz Data:
    ---
    ${JSON.stringify(data)}
    ---
    `;
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            score: { type: Type.NUMBER },
            results: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        question: { type: Type.STRING },
                        userAnswer: { type: Type.STRING },
                        correctAnswer: { type: Type.STRING },
                        isCorrect: { type: Type.BOOLEAN },
                    },
                    required: ['question', 'userAnswer', 'correctAnswer', 'isCorrect']
                }
            }
        },
    };

    const result = await handleApiCall(instruction, settings.model, true, schema);
    return JSON.parse(result);
};


export const ocrImage = async (imagePart: { inlineData: { data: string; mimeType: string; } }): Promise<string> => {
    const settings = getSettings();
    const prompt = "Extract all text from this image. Preserve line breaks. Respond in Arabic if the text is Arabic.";
    const result = await handleApiCall(prompt, settings.model, false, undefined, imagePart);
    return result.trim();
};

export const extractTextFromPdfChunk = async (
    pdfChunkPart: any, 
    translationConfig?: { source: string; target: string }
): Promise<string> => {
    const settings = getSettings();
    console.log(`[AI Service] extractTextFromPdfChunk called. Provider: ${settings.provider}`);

    const isTranslation = translationConfig && translationConfig.target;

    let prompt = `Extract text from this PDF chunk with high accuracy.
Target Languages: **Arabic & Kurdish**.
Strictly maintain the original structure using Markdown (headings, lists, tables).

**Critical Instructions:**
1. **Kurdish Text:** Write words correctly connected. DO NOT add extra spaces within words (e.g., write "ناوةڕاست" not "ن ا و ة ڕ ا س ت"). Preserve characters like (ێ، ۆ، ڵ، ە، ڕ).
2. **Format:** Use RTL direction. Represent headers with #.
3. **Empty Pages:** If a page is empty/image-only without text, write: \`[صفحة صورة أو فارغة]\`.
4. **Output:** Return ONLY the Markdown text. No introductions.
`;

    if (isTranslation) {
        prompt += `
5. **Translation:** Translate the extracted text to ${translationConfig.target}.
   - Source: ${translationConfig.source === 'auto' ? 'Auto-detect' : translationConfig.source}.
   - Output ONLY the translated Markdown.
`;
    } else {
        prompt += `
5. **Output:** Return only the extracted Markdown. No comments.
`;
    }

    prompt += `
6. **Separator:** End each page content with \`---PAGEBREAK---\`.
`;
    
    if (settings.provider !== 'google' && !(settings.provider === 'mistral' && settings.model === 'mistral-ocr-latest')) {
        const err = `[AI Service] Provider ${settings.provider} not supported for PDF OCR.`;
        console.error(err);
        throw new Error(`مزود الخدمة المختار (${settings.provider}) لا يدعم تحليل ملفات PDF مباشرة لاستخراج النصوص. يرجى استخدام Google أو Mistral OCR.`);
    }

    try {
        const result = await handleApiCall(prompt, settings.model, false, undefined, pdfChunkPart);
        console.log(`[AI Service] extractTextFromPdfChunk success. Result preview: ${result.substring(0, 50)}...`);
        return result.trim();
    } catch (e) {
        console.error(`[AI Service] extractTextFromPdfChunk failed:`, e);
        throw e;
    }
};

export const extractTextFromImageBatch = async (
    imageParts: { inlineData: { data: string; mimeType: string; } }[],
    translationConfig?: { source: string; target: string }
): Promise<string> => {
    const settings = getSettings();
    const isTranslation = translationConfig && translationConfig.target;
    
    let prompt = `أنت نظام خبير في التعرف الضوئي على الحروف (OCR) وتحويل المستندات.
المدخلات عبارة عن مجموعة من الصور لصفحات مستند.

مهمتك هي:
1. استخراج النص الموجود في هذه الصور بدقة فائقة.
2. التركيز الشديد على اللغتين **العربية والكردية**. تأكد من التعرف الصحيح على الأحرف الكردية الخاصة (مثل ێ، ۆ، ڵ، ە، ڕ).
3. **تنبيه هام للنص الكردي:** تجنب تماماً إضافة مسافات غير ضرورية بين الأحرف داخل الكلمة الواحدة. اكتب الكلمات الكردية بشكل متصل وصحيح.
4. الحفاظ على تنسيق الماركداون (العناوين، القوائم، الجداول).
`;

    if (isTranslation) {
        prompt += `
4. **مطلوب ترجمة:** بعد استخراج النص، قم بترجمته ترجمة احترافية ودقيقة
   - من اللغة: ${translationConfig.source === 'auto' ? 'الكشف التلقائي' : translationConfig.source}
   - إلى اللغة: ${translationConfig.target}
5. **المخرجات:** أرجع **فقط** النص المترجم النهائي بتنسيق ماركداون. لا ترجع النص الأصلي، ولا تضع ملاحظات جانبية.
`;
    } else {
        prompt += `
4. **المخرجات:** أرجع النص الأصلي المستخرج كما هو بتنسيق ماركداون.
`;
    }

    prompt += `
5. افصل بين محتوى كل صورة وأخرى بفاصل: \`---PAGEBREAK---\`.
`;

    // Use summarizeImages logic (multimodal list)
    if (settings.provider === 'google') {
        return await geminiService.generateMultiModalTextFromImages(prompt, imageParts);
    } else if (['openai', 'openrouter', 'mistral'].includes(settings.provider)) {
        // Construct message for OpenAI-compatible providers
        const url = '/api/ai';
        const content: any[] = [{ type: 'text', text: prompt }];
        
        imageParts.forEach(part => {
            content.push({
                type: 'image_url',
                image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` }
            });
        });

        const messages = [{ role: 'user', content }];

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                provider: settings.provider,
                model: settings.model,
                messages,
                userApiKey: settings.provider === 'mistral' ? settings.mistralApiKey : undefined,
            }),
        });
        
        const resBody = await res.json();
        if (!res.ok) {
            const errorMessage = resBody?.error?.message || `API Error: ${res.status}`;
            if (res.status === 429 || res.status === 401) throw new ApiLimitError(errorMessage);
            throw new Error(errorMessage);
        }

        return resBody.choices[0].message.content.trim();
    } else {
        throw new Error("Unsupported AI provider for multi-image processing.");
    }
};


export const describeImage = async (imagePart: { inlineData: { data: string; mimeType: string; } }): Promise<string> => {
    const settings = getSettings();
    const prompt = "Describe this image from a presentation slide in a concise and informative way, in Arabic.";
    const result = await handleApiCall(prompt, settings.model, false, undefined, imagePart);
    return result.trim();
};

export const correctText = async (originalText: string): Promise<string> => {
    const settings = getSettings();
    const prompt = `Correct any grammatical and spelling errors in the following Arabic text. Return only the corrected text, without any introductory phrases or explanations.
    
    Text:
    ---
    ${originalText}
    ---
    `;
    const result = await handleApiCall(prompt, settings.model);
    return result.trim();
};

export const getExcelAnalysis = async (csvData: string, prompt: string): Promise<string> => {
    const settings = getSettings();
    const fullPrompt = `You are a data analyst speaking Arabic. The user has provided you with data from a spreadsheet in CSV format. Your task is to answer the user's questions about this data.
If the user asks for a chart or visualization, you MUST respond with ONLY a valid JSON object for Chart.js. The JSON object should have 'type', 'data', and 'options' keys. Do not include any other text, explanation, or markdown formatting around the JSON. The chart labels and titles should be in Arabic.
For text-based answers, be concise, clear, and use Arabic.

Here is the data in CSV format:
---
${csvData.substring(0, 10000)}
---

Here is the user's question:
---
${prompt}
---
`;
    const result = await handleApiCall(fullPrompt, settings.model);
    return result.trim();
};

export const explainFormula = async (formula: string): Promise<string> => {
    const settings = getSettings();
    const prompt = `Explain the following spreadsheet formula in simple Arabic, detailing what each part does and what the overall result is. Formula: \`${formula}\``;
    const result = await handleApiCall(prompt, settings.model);
    return result.trim();
};


export const structureTextContent = async (text: string): Promise<StructuredContentItem[]> => {
    const settings = getSettings();
    const CHUNK_SIZE = 25000; 

    const textChunks = createChunks(text, CHUNK_SIZE);
    
    const schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                type: { type: Type.STRING },
                content: { type: Type.STRING },
                level: { type: Type.NUMBER },
            },
            required: ['type', 'content']
        }
    };

    const chunkPromises = textChunks.map(chunk => {
        const prompt = `Analyze the following text and structure it into an array of objects, where each object represents a heading or a paragraph. The language of the content must be Arabic.
        Each object must have a "type" ('heading' or 'paragraph') and "content" (the text).
        For headings, also include a "level" (1 for main titles, 2 for sub-headings, etc.).
        Return a single JSON array.

        Text:
        ---
        ${chunk}
        ---
        `;
        return handleApiCall(prompt, settings.model, true, schema).then(result => JSON.parse(result));
    });

    const resultsFromChunks = await Promise.all(chunkPromises);
    const combinedResult: StructuredContentItem[] = resultsFromChunks.flat();
    return combinedResult;
};

export const editPageTextWithAI = async (text: string, prompt: string): Promise<string> => {
    const settings = getSettings();
    const instruction = `Follow this instruction to edit the provided text: "${prompt}".
    Return ONLY the full, modified text. Do not add any commentary or explanation.
    
    Original Text:
    ---
    ${text}
    ---
    `;
    const result = await handleApiCall(instruction, settings.model);
    return result.trim();
};

export const analyzePdfLayout = async (imagePart: { inlineData: { data: string; mimeType: string; } }): Promise<any> => {
    const settings = getSettings();
    const prompt = `Analyze the layout of this document page. Identify key structural elements.
    Respond with a single JSON object with the following keys:
    - "layout": a string, either "single-column", "two-column", or "complex".
    - "hasTable": a boolean, true if a significant data table is visible.
    - "headings": an array of strings containing the text of major headings on the page.

    Example response: {"layout": "two-column", "hasTable": false, "headings": ["Introduction", "Methodology"]}
    `;
    
    const result = await handleApiCall(prompt, settings.model, true, {}, imagePart);
    try {
        return JSON.parse(result);
    } catch (e) {
        console.error("Failed to parse layout analysis from AI", e);
        return { layout: "single-column", hasTable: false, headings: [] };
    }
};

export const verifyApiKey = async (provider: 'openai' | 'openrouter' | 'mistral'): Promise<boolean> => {
    try {
        const settings = getSettings();
        const userKey = provider === 'mistral' ? settings.mistralApiKey : undefined;
        const res = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider, action: 'verify', userApiKey: userKey })
        });
        return res.ok;
    } catch (e) {
        return false;
    }
};

export const verifyGoogleApiKey = async (apiKey: string): Promise<boolean> => {
    return geminiService.verifyGoogleApiKey(apiKey);
};

export const fetchOpenRouterModels = async (): Promise<OpenRouterModel[]> => {
    const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'openrouter', action: 'fetchModels' })
    });
    if (!res.ok) {
        throw new Error("Failed to fetch models from OpenRouter via proxy.");
    }
    const { data } = await res.json();
    return data;
};