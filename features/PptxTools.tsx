import React, { useState, useEffect } from 'react';
import type { Service, StructuredContentItem } from '../types';
import FileUpload from '../components/FileUpload';
import Spinner from '../components/Spinner';
import { summarizeText, describeImage } from '../services/aiService';
import ResultView from '../components/ResultView';
import { PPT_SERVICES } from '../constants';
import ServiceCard from '../components/ServiceCard';
import GeneratePptx from './GeneratePptx';

declare const JSZip: any;
declare const html2canvas: any;
declare const PDFLib: any;

type PptxResult = {
    summary: string;
    images: { name: string; description: string; dataUrl: string; }[];
    slides: { name: string; dataUrl: string; }[];
} | null;

// --- Sub Component: Analyze PPTX (Original Logic) ---
const AnalyzePptx: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState('');
    const [error, setError] = useState('');
    const [result, setResult] = useState<PptxResult>(null);
    const [activeTab, setActiveTab] = useState<'summary' | 'images' | 'slides'>('summary');
    const [imageDescriptions, setImageDescriptions] = useState<Record<string, { description: string; isLoading: boolean }>>({});
    const [isPreviewAvailable, setIsPreviewAvailable] = useState(true);
    
    const slidePreviewContainerRef = React.useRef<HTMLDivElement>(null);

    const handleFileSelect = (files: File[]) => {
        const selectedFile = files[0];
        if (selectedFile) {
            const acceptedTypes = ['application/vnd.openxmlformats-officedocument.presentationml.presentation'];
            if (acceptedTypes.includes(selectedFile.type)) {
                setFile(selectedFile);
                setError('');
                setResult(null);
                handleProcessFile(selectedFile);
            } else {
                setError('الرجاء اختيار ملف PowerPoint (PPTX) فقط.');
            }
        }
    };
    
    const handleProcessFile = async (fileToProcess: File) => {
        setIsLoading(true);
        setError('');
        setProgress('جاري قراءة ملف PPTX...');
        
        try {
            const zip = await JSZip.loadAsync(fileToProcess);
            
            // 1. Extract Text for Summary
            setProgress('جاري استخراج النصوص للتلخيص...');
            let fullText = '';
            const slideFiles = zip.filter((path: any) => path.startsWith('ppt/slides/slide') && path.endsWith('.xml'));
            for (const slideFile of slideFiles) {
                const xmlText = await slideFile.async('string');
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
                xmlDoc.querySelectorAll('a\\:t').forEach(t => {
                    fullText += t.textContent + ' ';
                });
            }

            const summary = fullText.trim() ? await summarizeText(fullText, 'points', setProgress) : 'لم يتم العثور على نص في العرض التقديمي.';

            // 2. Extract Images
            setProgress('جاري استخراج الصور...');
            const imageFiles = zip.filter((path: any) => path.startsWith('ppt/media/'));
            const images: { name: string; description: string; dataUrl: string; }[] = [];
            
            const initialDescriptions: Record<string, { description: string; isLoading: boolean }> = {};
            for (const imageFile of imageFiles) {
                const blob = await imageFile.async('blob');
                const dataUrl = URL.createObjectURL(blob);
                images.push({ name: imageFile.name, dataUrl, description: '' });
                initialDescriptions[imageFile.name] = { description: '', isLoading: true };
            }
            setImageDescriptions(initialDescriptions);

            // 3. Render slides for export (SAFE CHECK ADDED)
            setProgress('جاري عرض الشرائح للتصدير...');
            const pptxLib = (window as any).pptx;
            if (slidePreviewContainerRef.current) {
                 if (pptxLib && typeof pptxLib.render === 'function') {
                    setIsPreviewAvailable(true);
                    try {
                        await pptxLib.render(fileToProcess, slidePreviewContainerRef.current, null, { slideRatio: "16:9", responsive: true });
                        // Artificial delay to ensure rendering is complete before canvas capture
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } catch (renderErr) {
                        console.warn("PPTX Render Error:", renderErr);
                        setIsPreviewAvailable(false);
                    }
                 } else {
                     console.warn("PPTX preview library is not loaded or invalid.");
                     setIsPreviewAvailable(false);
                 }
            }

            setResult({ summary, images, slides: [] });
            setIsLoading(false);
            setProgress('');

        } catch (err: any) {
            setError('فشل في معالجة ملف PPTX. قد يكون الملف تالفًا أو بصيغة غير مدعومة.');
            console.error(err);
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        if (result?.images && result.images.length > 0) {
            result.images.forEach(image => {
                if (imageDescriptions[image.name]?.isLoading) {
                    generateImageDescription(image);
                }
            });
        }
    }, [result]);

    const generateImageDescription = async (image: { name: string; dataUrl: string; }) => {
        try {
            const response = await fetch(image.dataUrl);
            const blob = await response.blob();
            
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64data = (reader.result as string).split(',')[1];
                const imagePart = { inlineData: { data: base64data, mimeType: blob.type } };
                const description = await describeImage(imagePart);
                setImageDescriptions(prev => ({
                    ...prev,
                    [image.name]: { description, isLoading: false }
                }));
            };
        } catch(e) {
            console.error("Failed to describe image", e);
            setImageDescriptions(prev => ({
                ...prev,
                [image.name]: { description: 'فشل في إنشاء الوصف', isLoading: false }
            }));
        }
    };

    const handleExportSlides = async () => {
        if (!slidePreviewContainerRef.current) return;
        
        setIsLoading(true);
        setProgress('جاري تصدير الشرائح...');
        try {
            const zip = new JSZip();
            const slideElements = slidePreviewContainerRef.current.querySelectorAll('.slide');
            for (let i = 0; i < slideElements.length; i++) {
                setProgress(`جاري معالجة الشريحة ${i + 1} من ${slideElements.length}...`);
                const canvas = await html2canvas(slideElements[i] as HTMLElement, { scale: 2 });
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                if (blob) {
                    zip.file(`slide-${i + 1}.png`, blob);
                }
            }
            const content = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `${file?.name.replace(/\.pptx$/i, '')}-slides.zip`;
            link.click();
            URL.revokeObjectURL(link.href);
        } catch (e) {
            setError('حدث خطأ أثناء تصدير الشرائح.');
        } finally {
            setIsLoading(false);
            setProgress('');
        }
    }

    const handleExportPdf = async () => {
        if (!slidePreviewContainerRef.current || !file) return;

        setIsLoading(true);
        setProgress('جاري تحويل الشرائح إلى PDF...');
        setError('');

        try {
            const { PDFDocument } = PDFLib;
            const pdfDoc = await PDFDocument.create();

            const slideElements = slidePreviewContainerRef.current.querySelectorAll('.slide');
            for (let i = 0; i < slideElements.length; i++) {
                setProgress(`جاري معالجة الشريحة ${i + 1} من ${slideElements.length}...`);
                const canvas = await html2canvas(slideElements[i] as HTMLElement, { scale: 2 });
                const dataUrl = canvas.toDataURL('image/png');
                
                const pngImageBytes = await fetch(dataUrl).then(res => res.arrayBuffer());
                const pngImage = await pdfDoc.embedPng(pngImageBytes);

                const page = pdfDoc.addPage([pngImage.width, pngImage.height]);
                
                page.drawImage(pngImage, {
                    x: 0,
                    y: 0,
                    width: pngImage.width,
                    height: pngImage.height,
                });
            }

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${file.name.replace(/\.pptx$/i, '')}.pdf`;
            link.click();
            URL.revokeObjectURL(link.href);

        } catch (e) {
            setError('حدث خطأ أثناء إنشاء ملف PDF.');
            console.error(e);
        } finally {
            setIsLoading(false);
            setProgress('');
        }
    };

    const handleReset = () => {
        setFile(null);
        setResult(null);
        setError('');
        setProgress('');
        setIsLoading(false);
    };

    const structuredSummary: StructuredContentItem[] = result ? [{ type: 'paragraph', content: result.summary }] : [];

    return (
        <div className="max-w-5xl mx-auto">
            {!result && (
                <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg max-w-3xl mx-auto">
                    <div className="flex flex-col items-center">
                        <FileUpload
                            onFileSelect={handleFileSelect}
                            acceptedFileTypes=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                            promptText="اسحب وأفلت ملف PowerPoint (PPTX) هنا أو انقر للاختيار"
                        />
                        {isLoading && <div className="mt-4 flex flex-col items-center gap-2"><Spinner /><p className="text-slate-600 dark:text-slate-300">{progress}</p></div>}
                    </div>
                </div>
            )}

            {result && (
                <ResultView
                    title={`نتائج تحليل: ${file?.name}`}
                    onReset={handleReset}
                    canSaveToLibrary={true}
                    structuredContent={structuredSummary}
                    fileName={`ملخص - ${file?.name}`}
                    fileType="text/plain"
                >
                    <div role="tablist" className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-lg mb-6 max-w-md mx-auto">
                        <button role="tab" aria-selected={activeTab === 'summary'} onClick={() => setActiveTab('summary')} className={`flex-1 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${activeTab === 'summary' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                            الملخص
                        </button>
                        <button role="tab" aria-selected={activeTab === 'images'} onClick={() => setActiveTab('images')} className={`flex-1 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${activeTab === 'images' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                            الصور
                        </button>
                        <button role="tab" aria-selected={activeTab === 'slides'} onClick={() => setActiveTab('slides')} disabled={!isPreviewAvailable} className={`flex-1 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${activeTab === 'slides' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed'}`}>
                            الشرائح
                        </button>
                    </div>

                    <div className="text-right">
                        {activeTab === 'summary' && (
                            <div role="tabpanel" className="prose prose-slate dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: result.summary.replace(/\n/g, '<br />') }} />
                        )}
                        {activeTab === 'images' && (
                            <div role="tabpanel">
                                {result.images.length === 0 ? <p>لم يتم العثور على صور في هذا الملف.</p> : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {result.images.map(image => (
                                        <div key={image.name} className="border dark:border-slate-700 rounded-lg p-2 flex flex-col items-center">
                                            <img src={image.dataUrl} alt={image.name} className="max-w-full h-auto rounded-md mb-2" />
                                            <div className="w-full text-center p-2 bg-slate-50 dark:bg-slate-700 rounded-b-lg min-h-[60px]">
                                                {imageDescriptions[image.name]?.isLoading ? <Spinner /> : <p className="text-sm text-slate-700 dark:text-slate-300">{imageDescriptions[image.name]?.description}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                )}
                            </div>
                        )}
                        {activeTab === 'slides' && (
                             <div role="tabpanel" className="text-center">
                                 {!isPreviewAvailable ? (
                                     <div className="p-4 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg text-amber-800 dark:text-amber-200">
                                         معاينة الشرائح وتصديرها غير متوفرة حالياً لأن المكتبة اللازمة لم يتم تحميلها بشكل صحيح.
                                     </div>
                                 ) : (
                                     <>
                                        <p className="mb-4 text-slate-600 dark:text-slate-300">يمكنك تصدير جميع الشرائح كصور عالية الجودة (في ملف ZIP) أو كمستند PDF واحد.</p>
                                        <div className="flex flex-wrap justify-center gap-4">
                                            <button onClick={handleExportSlides} disabled={isLoading} className="bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 transition-colors disabled:bg-slate-400 flex items-center gap-2 mx-auto">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                                <span>تنزيل كصور (ZIP)</span>
                                            </button>
                                            <button onClick={handleExportPdf} disabled={isLoading} className="bg-sky-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-sky-700 transition-colors disabled:bg-slate-400 flex items-center gap-2 mx-auto">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                                <span>تنزيل كـ PDF</span>
                                            </button>
                                        </div>
                                        {isLoading && <div className="mt-4 flex flex-col items-center gap-2"><Spinner /><p>{progress}</p></div>}
                                     </>
                                 )}
                             </div>
                        )}
                    </div>

                </ResultView>
            )}
             {error && <p role="alert" className="mt-4 text-red-500 bg-red-100 dark:bg-red-900/50 dark:text-red-300 p-3 rounded-md w-full text-center">{error}</p>}
             
             {/* Hidden container for rendering slides */}
             <div ref={slidePreviewContainerRef} className="hidden"></div>
        </div>
    );
};

// --- Main Hub Component: PptxTools ---
const PptxTools: React.FC<{ onSelectService: (service: Service) => void }> = ({ onSelectService }) => {
    const [selectedSubService, setSelectedSubService] = useState<Service | null>(null);

    const handleBack = () => {
        setSelectedSubService(null);
    };

    if (selectedSubService) {
        return (
            <div>
                 <button
                    onClick={handleBack}
                    className="mb-6 flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors font-semibold"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transform scale-x-[-1]" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    <span>العودة إلى أدوات PowerPoint</span>
                </button>
                {selectedSubService.id === 'analyze-pptx' && <AnalyzePptx />}
                {selectedSubService.id === 'generate-pptx' && <GeneratePptx />}
            </div>
        );
    }

    return (
        <div>
            <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-bold text-slate-800 dark:text-slate-100 mb-4">أدوات PowerPoint</h1>
                <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
                    حلول ذكية للتعامل مع العروض التقديمية: تلخيص، استخراج محتوى، وإنشاء عروض جديدة.
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                {PPT_SERVICES.map((service) => (
                    <ServiceCard key={service.id} service={service} onClick={setSelectedSubService} />
                ))}
            </div>
        </div>
    );
};

export default PptxTools;