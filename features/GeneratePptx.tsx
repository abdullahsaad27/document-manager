import React, { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { getSettings } from '../services/settingsService';
import Spinner from '../components/Spinner';
import FileUpload from '../components/FileUpload';
import { extractTextFromFile } from '../services/textExtractorService';
import ResultView from '../components/ResultView';

declare const PptxGenJS: any;

interface SlideData {
    title: string;
    bullets: string[];
    notes: string;
}

const GeneratePptx: React.FC = () => {
    const [mode, setMode] = useState<'topic' | 'file'>('topic');
    const [topic, setTopic] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [numSlides, setNumSlides] = useState(5);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [generatedFile, setGeneratedFile] = useState<File | null>(null);

    const handleFileSelect = (files: File[]) => {
        if (files.length > 0) setFile(files[0]);
    };

    const generateSlidesContent = async (context: string): Promise<SlideData[]> => {
        const settings = getSettings();
        const apiKey = settings.googleApiKey || process.env.API_KEY;
        if (!apiKey) throw new Error("API Key missing");

        const ai = new GoogleGenAI({ apiKey });
        const model = settings.model || 'gemini-3-flash-preview';
        
        const prompt = `Create a PowerPoint presentation outline about the following context. 
        Create exactly ${numSlides} slides.
        For each slide, provide a 'title', an array of 'bullets' (3-5 points), and 'notes' for the speaker.
        The content must be in Arabic.
        
        Context:
        ${context.substring(0, 30000)}
        `;

        const schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
                    notes: { type: Type.STRING }
                },
                required: ['title', 'bullets']
            }
        };

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: schema
            }
        });

        return JSON.parse(response.text || '[]');
    };

    const createPptxFile = async (slides: SlideData[]) => {
        if (!(window as any).PptxGenJS) throw new Error("PptxGenJS library not loaded");
        
        const pptx = new (window as any).PptxGenJS();
        pptx.layout = 'LAYOUT_16x9';
        pptx.rtlMode = true; // Enable RTL for Arabic

        slides.forEach(slideData => {
            const slide = pptx.addSlide();
            
            // Title
            slide.addText(slideData.title, { 
                x: 0.5, y: 0.5, w: '90%', h: 1, 
                fontSize: 24, bold: true, color: '363636', align: 'right', isTextBox: true, dir: 'rtl'
            });

            // Bullets
            slide.addText(slideData.bullets.map(b => ({ text: b, options: { dir: 'rtl', align: 'right' } })), {
                x: 0.5, y: 1.8, w: '90%', h: '60%',
                fontSize: 18, color: '555555', align: 'right', bullet: true, isTextBox: true
            });
            
            // Notes
            if (slideData.notes) {
                slide.addNotes(slideData.notes);
            }
        });

        const blob = await pptx.write("blob");
        return new File([blob], `presentation-${Date.now()}.pptx`, { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
    };

    const handleGenerate = async () => {
        setIsLoading(true);
        setError('');
        setStatus('جاري تحضير المحتوى...');
        
        try {
            let context = '';
            if (mode === 'topic') {
                if (!topic.trim()) throw new Error("الرجاء إدخال موضوع.");
                context = topic;
            } else {
                if (!file) throw new Error("الرجاء اختيار ملف.");
                setStatus('جاري قراءة الملف...');
                context = await extractTextFromFile(file, () => {});
                if (!context.trim()) throw new Error("الملف فارغ.");
            }

            setStatus('جاري توليد هيكل الشرائح بالذكاء الاصطناعي...');
            const slidesData = await generateSlidesContent(context);
            
            setStatus('جاري إنشاء ملف PowerPoint...');
            const pptxFile = await createPptxFile(slidesData);
            
            setGeneratedFile(pptxFile);
            setStatus('تم الانتهاء!');
        } catch (e: any) {
            setError(e.message || "حدث خطأ أثناء التوليد.");
        } finally {
            setIsLoading(false);
        }
    };

    if (generatedFile) {
        return (
            <ResultView
                title="تم إنشاء العرض التقديمي!"
                file={generatedFile}
                onReset={() => { setGeneratedFile(null); setStatus(''); }}
            />
        );
    }

    return (
        <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg">
             <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6 text-center">إنشاء عرض PowerPoint</h2>
             
             <div className="flex justify-center gap-4 mb-6">
                 <button onClick={() => setMode('topic')} className={`px-4 py-2 rounded-lg ${mode === 'topic' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-800'}`}>موضوع</button>
                 <button onClick={() => setMode('file')} className={`px-4 py-2 rounded-lg ${mode === 'file' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-800'}`}>من ملف</button>
             </div>

             <div className="mb-6">
                 {mode === 'topic' ? (
                     <textarea
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="اكتب موضوع العرض التقديمي هنا..."
                        className="w-full p-4 border rounded-lg bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600"
                        rows={4}
                     />
                 ) : (
                     <FileUpload
                        onFileSelect={handleFileSelect}
                        acceptedFileTypes=".pdf,.docx,.txt"
                        promptText={file ? file.name : "اختر ملفاً لتحويله إلى عرض تقديمي"}
                     />
                 )}
             </div>

             <div className="mb-6 flex items-center gap-4">
                 <label className="font-semibold">عدد الشرائح:</label>
                 <input 
                    type="number" 
                    min="1" max="20" 
                    value={numSlides} 
                    onChange={(e) => setNumSlides(parseInt(e.target.value))}
                    className="p-2 border rounded w-20 text-center dark:bg-slate-700"
                 />
             </div>

             <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 disabled:bg-slate-400"
             >
                {isLoading ? <Spinner /> : 'إنشاء العرض التقديمي'}
             </button>
             
             {status && <p className="mt-4 text-center text-slate-600 dark:text-slate-300">{status}</p>}
             {error && <p className="mt-4 text-center text-red-500">{error}</p>}
        </div>
    );
};

export default GeneratePptx;