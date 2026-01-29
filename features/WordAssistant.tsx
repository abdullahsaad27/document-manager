import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { getSettings } from '../services/settingsService';
import FileUpload from '../components/FileUpload';
import Spinner from '../components/Spinner';
import { ChatMessage } from '../types';
import { ApiLimitError } from '../services/aiService';
import { useAppContext } from '../AppContext';

declare const mammoth: any;

const WordAssistant: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [htmlContent, setHtmlContent] = useState('');
    const [rawText, setRawText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Chat State
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [userInput, setUserInput] = useState('');
    const [isAiThinking, setIsAiThinking] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const { setInterruptedTask } = useAppContext();

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const handleFileSelect = async (files: File[]) => {
        if (files.length > 0) {
            const selectedFile = files[0];
            if (!selectedFile.type.includes('wordprocessingml.document')) {
                setError('الرجاء اختيار ملف Word (DOCX) فقط.');
                return;
            }
            
            setFile(selectedFile);
            setIsLoading(true);
            setError('');
            setMessages([]);
            
            try {
                const arrayBuffer = await selectedFile.arrayBuffer();
                
                if (!(window as any).mammoth) {
                    throw new Error("مكتبة Mammoth غير متوفرة.");
                }

                // Convert to HTML for preview
                const resultHtml = await mammoth.convertToHtml({ arrayBuffer });
                setHtmlContent(resultHtml.value);

                // Extract raw text for AI context
                const resultText = await mammoth.extractRawText({ arrayBuffer });
                setRawText(resultText.value);
                
                // Add initial greeting
                setMessages([{
                    role: 'assistant',
                    content: `مرحباً! لقد قمت بتحليل "${selectedFile.name}". يمكنك الآن سؤالي عن أي شيء يخص محتوى الملف، أو طلب تلخيصه، أو إعادة صياغة أجزاء منه.`
                }]);

            } catch (err: any) {
                setError('فشل في قراءة ملف Word. تأكد من أنه غير تالف.');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleSendMessage = async () => {
        if (!userInput.trim() || !rawText) return;

        const userMsg = userInput;
        setUserInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsAiThinking(true);

        try {
            const settings = getSettings();
            const apiKey = settings.googleApiKey || process.env.API_KEY;
            
            if (!apiKey) throw new Error("API Key missing");

            const ai = new GoogleGenAI({ apiKey });
            const model = settings.model || 'gemini-3-flash-preview';

            const prompt = `
            Context from Word Document:
            """
            ${rawText.substring(0, 30000)} 
            """
            
            User Question: ${userMsg}
            
            Please answer the user's question based on the document context above. 
            Respond in Arabic unless the user asks otherwise. 
            If the user asks for rewriting or translation, perform the task directly.
            `;

            const response = await ai.models.generateContent({
                model: model,
                contents: prompt,
            });

            const aiResponse = response.text || "عذراً، لم أتمكن من الرد.";
            
            setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);

        } catch (err: any) {
            if (err.message?.includes('429') || err instanceof ApiLimitError) {
                 setInterruptedTask({
                    serviceId: 'word-assistant',
                    resume: handleSendMessage, // Ideally, we'd restore state perfectly
                    context: {}
                });
                setMessages(prev => [...prev, { role: 'assistant', content: "تم الوصول إلى حد الاستخدام. يرجى المحاولة لاحقاً." }]);
            } else {
                setMessages(prev => [...prev, { role: 'assistant', content: "حدث خطأ أثناء المعالجة." }]);
            }
            console.error(err);
        } finally {
            setIsAiThinking(false);
        }
    };

    const handleReset = () => {
        setFile(null);
        setHtmlContent('');
        setRawText('');
        setMessages([]);
        setError('');
    };

    return (
        <div className="max-w-7xl mx-auto h-[85vh] flex flex-col">
            {!file ? (
                <div className="flex-grow flex items-center justify-center bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg">
                    <div className="w-full max-w-2xl flex flex-col items-center">
                        <FileUpload
                            onFileSelect={handleFileSelect}
                            acceptedFileTypes=".docx"
                            promptText="اسحب وأفلت ملف Word (DOCX) هنا"
                            promptSubText="للدردشة، التلخيص، والتحليل الذكي"
                        />
                        {isLoading && <div className="mt-6"><Spinner /></div>}
                        {error && <p className="mt-4 text-red-500 bg-red-100 dark:bg-red-900/50 p-3 rounded">{error}</p>}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col lg:flex-row gap-6 h-full">
                    {/* Document Viewer (Left/Top) */}
                    <div className="lg:w-3/5 bg-white dark:bg-slate-800 rounded-xl shadow-lg flex flex-col overflow-hidden">
                        <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-md" title={file.name}>{file.name}</h3>
                            <button onClick={handleReset} className="text-sm text-red-500 hover:text-red-700">إغلاق الملف</button>
                        </div>
                        <div className="flex-grow overflow-y-auto p-8 bg-white text-slate-900 document-preview">
                            {/* Using dangerouslySetInnerHTML for the Mammoth output. 
                                In a production app, sanitize this HTML. */}
                            <div 
                                className="prose max-w-none"
                                dangerouslySetInnerHTML={{ __html: htmlContent }} 
                                style={{ direction: 'rtl', textAlign: 'right' }}
                            />
                        </div>
                    </div>

                    {/* Chat Interface (Right/Bottom) */}
                    <div className="lg:w-2/5 bg-white dark:bg-slate-800 rounded-xl shadow-lg flex flex-col border border-slate-200 dark:border-slate-700">
                        <div className="p-4 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                المساعد الذكي
                            </h3>
                        </div>
                        
                        <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-800/50" ref={chatContainerRef}>
                            {messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`max-w-[85%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-700 border dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-tl-none shadow-sm'}`}>
                                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                    </div>
                                </div>
                            ))}
                            {isAiThinking && (
                                <div className="flex justify-end">
                                    <div className="bg-white dark:bg-slate-700 p-3 rounded-lg rounded-tl-none shadow-sm border dark:border-slate-600">
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-white dark:bg-slate-800 border-t dark:border-slate-700">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={userInput}
                                    onChange={(e) => setUserInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                    placeholder="اطلب تلخيصاً، ترجمة، أو استفسر عن المحتوى..."
                                    className="flex-grow p-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-slate-700 dark:text-white"
                                    disabled={isAiThinking}
                                />
                                <button 
                                    onClick={handleSendMessage}
                                    disabled={isAiThinking || !userInput.trim()}
                                    className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transform scale-x-[-1]"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WordAssistant;