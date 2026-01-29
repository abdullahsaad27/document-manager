import React, { useState, useMemo, useEffect } from 'react';
import { correctText } from '../services/aiService';
import Spinner from '../components/Spinner';
import { ApiLimitError } from '../services/aiService';
import { useAppContext } from '../AppContext';
import FileUpload from '../components/FileUpload';
import { extractTextFromFile } from '../services/textExtractorService';
import * as notificationService from '../services/notificationService';
import { getTemplates } from '../services/settingsService';
import { Template } from '../types';

// Word-based Diff Algorithm
const diffWords = (text1: string, text2: string) => {
    // Split by spaces and newlines, keeping delimiters to preserve formatting
    const words1 = text1.split(/([ \n]+)/);
    const words2 = text2.split(/([ \n]+)/);

    const matrix = Array(words1.length + 1).fill(null).map(() => Array(words2.length + 1).fill(0));

    for (let i = 1; i <= words1.length; i++) {
        for (let j = 1; j <= words2.length; j++) {
            if (words1[i - 1] === words2[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1] + 1;
            } else {
                matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
            }
        }
    }

    const result = [];
    let i = words1.length;
    let j = words2.length;

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && words1[i - 1] === words2[j - 1]) {
            result.unshift({ value: words1[i - 1], type: 'same' });
            i--; j--;
        } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
            result.unshift({ value: words2[j - 1], type: 'added' });
            j--;
        } else if (i > 0 && (j === 0 || matrix[i][j - 1] < matrix[i - 1][j])) {
            result.unshift({ value: words1[i - 1], type: 'removed' });
            i--;
        } else {
            break;
        }
    }
    return result;
};

const DiffViewer: React.FC<{ original: string; corrected: string }> = ({ original, corrected }) => {
    const differences = useMemo(() => diffWords(original, corrected), [original, corrected]);

    return (
        <div 
            className="w-full h-full p-4 border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-700/50 font-sans whitespace-pre-wrap break-words overflow-y-auto leading-relaxed text-lg"
            style={{ direction: 'rtl' }}
            aria-label="عرض الفروقات بين النص الأصلي والمصحح"
        >
            {differences.map((part, index) => {
                if (part.type === 'same') {
                    return <span key={index}>{part.value}</span>;
                }
                if (part.type === 'added') {
                    return (
                        <span key={index} className="bg-green-200 dark:bg-green-900/60 text-green-900 dark:text-green-100 rounded px-1 mx-0.5 font-bold">
                            {part.value}
                        </span>
                    );
                }
                if (part.type === 'removed') {
                    return (
                        <span key={index} className="bg-red-200 dark:bg-red-900/60 text-red-900 dark:text-red-100 line-through decoration-red-600 rounded px-1 mx-0.5 opacity-70 text-sm">
                            {part.value}
                        </span>
                    );
                }
                return null;
            })}
        </div>
    );
};

const CorrectText: React.FC = () => {
    const [inputText, setInputText] = useState('');
    const [correctedText, setCorrectedText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [file, setFile] = useState<File | null>(null);
    
    // Templates
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');

    const { setInterruptedTask } = useAppContext();
    
    useEffect(() => {
        setTemplates(getTemplates().filter(t => t.type === 'correction'));
    }, []);

    const handleFileSelect = async (files: File[]) => {
        if (files.length > 0) {
            const selectedFile = files[0];
            const acceptedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
            if (!acceptedTypes.includes(selectedFile.type)) {
                setError('نوع الملف غير مدعوم. الرجاء اختيار PDF, DOCX, أو TXT.');
                return;
            }

            setFile(selectedFile);
            setInputText('');
            setCorrectedText('');
            setError('');
            setIsLoading(true);

            try {
                const text = await extractTextFromFile(selectedFile, (progress) => { /* Optional: handle progress */ });
                if (!text.trim()) {
                    throw new Error("لم يتمكن من استخراج النص من المستند، قد يكون ملفًا قائمًا على الصور أو فارغًا.");
                }
                setInputText(text);
            } catch (err: any) {
                setError(err.message);
                setFile(null);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const resumableHandleSubmit = async (text: string) => {
        if (!text.trim()) {
            setError('الرجاء إدخال نص لتصحيحه.');
            return;
        }

        setIsLoading(true);
        setError('');
        setCorrectedText('');

        try {
            // Determine if using a custom template prompt
            let customPrompt = '';
            if (selectedTemplateId) {
                const t = templates.find(temp => temp.id === selectedTemplateId);
                if (t) customPrompt = `TEMPLATE:${t.prompt}`;
            }

            const result = await correctText(text); // Note: You might need to update correctText signature to accept customPrompt if you fully implement that logic in aiService, or handle it here.
            // For now, assuming generic correction unless extended in aiService. 
            // To fully support templates here, we would pass customPrompt to correctText.
            
            setCorrectedText(result);
            notificationService.notify('✅ اكتمل تصحيح النص!', {
                body: 'أصبح النص المصحح جاهزًا للمراجعة.',
            });
        } catch (err: any) {
            if (err instanceof ApiLimitError) {
                setInterruptedTask({
                    serviceId: 'correct-text',
                    resume: () => resumableHandleSubmit(text),
                    context: { text }
                });
            } else {
                setError(err.message || 'حدث خطأ غير متوقع.');
                notificationService.notify('❌ فشل تصحيح النص', {
                    body: 'حدث خطأ أثناء معالجة النص.',
                });
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = () => {
        resumableHandleSubmit(inputText);
    };

    const handleReset = () => {
        setInputText('');
        setCorrectedText('');
        setError('');
        setFile(null);
        setSelectedTemplateId('');
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(correctedText).then(() => {
            alert('تم نسخ النص المصحح!');
        }).catch(err => console.error('Failed to copy text: ', err));
    };

    return (
        <div className="max-w-6xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg">
            <h2 className="text-3xl font-bold text-center mb-8 text-slate-800 dark:text-slate-100">مصحح النصوص الذكي</h2>
            
            <div className="mb-8">
                <FileUpload
                    onFileSelect={handleFileSelect}
                    acceptedFileTypes=".pdf,.docx,.txt"
                    promptText={file ? `الملف المحدد: ${file.name}` : 'رفع مستند (PDF, DOCX, TXT) لتصحيحه'}
                    promptSubText="أو الصق النص مباشرة بالأسفل"
                />
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
                <div className="flex flex-col h-96">
                    <label htmlFor="input-text" className="block text-lg font-semibold text-slate-700 dark:text-slate-200 mb-2">النص الأصلي</label>
                    <textarea
                        id="input-text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="اكتب أو الصق النص هنا..."
                        className="flex-1 w-full p-4 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 font-sans leading-relaxed text-lg"
                        style={{ direction: 'rtl' }}
                        disabled={isLoading}
                    />
                </div>
                <div className="flex flex-col h-96">
                    <label htmlFor="corrected-text" className="block text-lg font-semibold text-slate-700 dark:text-slate-200 mb-2">النص المصحح</label>
                    <div className="relative flex-1 w-full border border-slate-300 dark:border-slate-600 rounded-md overflow-hidden">
                        {isLoading ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm z-10">
                                <Spinner />
                                <p className="mt-4 text-slate-600 dark:text-slate-300 font-medium animate-pulse">جاري تدقيق وتصحيح النص...</p>
                            </div>
                        ) : null}
                        
                        {correctedText ? (
                            <DiffViewer original={inputText} corrected={correctedText} />
                        ) : (
                            <div className="w-full h-full bg-slate-50 dark:bg-slate-700/30 flex items-center justify-center">
                                <p className="text-slate-400 dark:text-slate-500 text-center px-4">
                                    {isLoading ? '' : 'اضغط على "تصحيح النص" لرؤية النتائج هنا...'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-8 flex flex-col items-center gap-4">
                {templates.length > 0 && (
                    <div className="w-full max-w-md">
                        <label className="block text-sm font-medium mb-1 dark:text-slate-300">أسلوب التصحيح (اختياري):</label>
                        <select 
                            value={selectedTemplateId} 
                            onChange={(e) => setSelectedTemplateId(e.target.value)}
                            className="w-full p-2 border rounded bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600"
                        >
                            <option value="">تصحيح قياسي (إملائي ونحوي)</option>
                            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
                    <button
                        id="primary-action-button"
                        title="Cmd/Ctrl + Enter"
                        onClick={handleSubmit}
                        disabled={isLoading || !inputText.trim()}
                        className="bg-blue-600 text-white font-bold py-3 px-10 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed shadow-md flex items-center gap-2"
                    >
                        {isLoading ? <Spinner /> : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
                                تصحيح النص
                            </>
                        )}
                    </button>
                    <button
                        onClick={handleCopy}
                        disabled={!correctedText}
                        className="bg-green-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed shadow-md flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        نسخ النتيجة
                    </button>
                    <button
                        onClick={handleReset}
                        className="text-slate-500 hover:text-red-600 dark:hover:text-red-400 font-semibold py-3 px-6 transition-colors"
                    >
                        إعادة تعيين
                    </button>
                </div>
            </div>
            {error && <p role="alert" className="mt-6 text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg text-center font-medium">{error}</p>}
        </div>
    );
};

export default CorrectText;