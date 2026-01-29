import React, { useState, useCallback, useRef, useEffect } from 'react';
import { structureTextContent } from '../services/aiService';
import { initDB, saveDocument, getCache, setCache } from '../services/database';
import Spinner from '../components/Spinner';
import type { Service, StructuredContentItem, LibraryDocument, StagedFile } from '../types';
import { useAppContext } from '../AppContext';
import { ApiLimitError } from '../services/aiService';
import FileUpload from '../components/FileUpload';
import ResultView from '../components/ResultView';
import { extractTextFromFile } from '../services/textExtractorService';
import * as notificationService from '../services/notificationService';
import { SERVICES } from '../constants';

interface OutlineItem {
    title: string;
    page?: number;
    id?: string;
}

interface ViewDocProps {
    document?: LibraryDocument;
    onNavigateToService: (service: Service) => void;
}

const ViewDoc: React.FC<ViewDocProps> = ({ document, onNavigateToService }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [structuredContent, setStructuredContent] = useState<StructuredContentItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSaved, setIsSaved] = useState(false);
  const [scale, setScale] = useState(1.5);
  
  const [isImageBasedPdf, setIsImageBasedPdf] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { setInterruptedTask, setStagedFile } = useAppContext();
  
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 3.0;
  const SCALE_STEP = 0.25;

  useEffect(() => {
    initDB();
  }, []);

  const generateFileKey = (file: File, type: 'analysis' | 'ocr') => 
    `view-doc-${type}-${file.name}-${file.size}-${file.lastModified}`;

  const generateOutlineFromStructure = (structure: StructuredContentItem[]) => {
    const generatedOutline: OutlineItem[] = [];
    structure.forEach((item, index) => {
        if (item.type === 'heading') {
            generatedOutline.push({
                title: item.content,
                id: `heading-${index}`
            });
        }
    });
    return generatedOutline;
  };
  
    const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current) return;
    setIsLoading(true);
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      if(context){
          await page.render({ canvasContext: context, viewport: viewport }).promise;
      }
      setCurrentPage(pageNum);
    } catch (e) {
      setError("فشل عرض الصفحة.");
    } finally {
      setIsLoading(false);
    }
  }, [pdfDoc, scale]);

  const processFile = async (fileToProcess: File) => {
      setError('');
      setOutline([]);
      setPdfDoc(null);
      setStructuredContent([]);
      setCurrentPage(1);
      setIsSaved(false);
      setIsImageBasedPdf(false);
      setIsLoading(true);
      setProgress('جاري قراءة الملف الأولي...');

      const analysisKey = generateFileKey(fileToProcess, 'analysis');
      try {
        const cachedData = await getCache(analysisKey);
        if (cachedData) {
            console.log("Loading analysis from cache...");
            setOutline(cachedData.outline);
            if (cachedData.structuredContent) {
                setStructuredContent(cachedData.structuredContent);
            }
            if (fileToProcess.type === 'application/pdf' && !cachedData.structuredContent) {
                const globalPDFLib = (window as any).PDFLib;
                const globalPdfjsLib = (window as any).pdfjsLib;
                if (!globalPDFLib) throw new Error("مكتبة PDFLib لم يتم تحميلها.");
                if (!globalPdfjsLib) throw new Error("مكتبة PDF.js لم يتم تحميلها.");

                const { PDFDocument } = globalPDFLib;
                const arrayBuffer = await fileToProcess.arrayBuffer();
                
                 // Advanced reconstruction to handle potentially corrupt files
                setProgress('جاري إصلاح بنية المستند...');
                let repairedBytes;
                try {
                    const originalDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
                    const newDoc = await PDFDocument.create();
                    const copiedPages = await newDoc.copyPages(originalDoc, originalDoc.getPageIndices());
                    copiedPages.forEach((page: any) => newDoc.addPage(page));
                    try {
                       const form = newDoc.getForm();
                       if (form.getFields().length > 0) form.flatten();
                    } catch(e) { /* ignore */ }
                    repairedBytes = await newDoc.save();
                } catch (repairError) {
                     throw new Error("فشل في معالجة ملف PDF. قد يكون الملف تالفًا أو غير متوافق.");
                }
                
                const pdf = await globalPdfjsLib.getDocument({ data: repairedBytes, verbosity: 1 }).promise;
                setPdfDoc(pdf);
            }
            setIsLoading(false);
            setProgress('');
            return;
        }
      } catch (e: any) {
           if (e.message.includes("فشل في معالجة ملف PDF")) {
              setError(e.message);
              setIsLoading(false);
              return;
          }
          console.warn("Could not read analysis cache.", e);
      }

      try {
        const textToStructure = await extractTextFromFile(fileToProcess, setProgress);
        
        if (!textToStructure.trim()) {
            if (fileToProcess.type === 'application/pdf') {
                setIsImageBasedPdf(true);
                setIsLoading(false);
                setProgress('');
                return;
            } else {
                throw new Error("المستند يبدو فارغًا.");
            }
        }
        
        setProgress('تم استخراج النص، جاري الآن إنشاء الفهرس الذكي...');
        const structuredData = await structureTextContent(textToStructure);
        const generatedOutline = generateOutlineFromStructure(structuredData);
        
        setStructuredContent(structuredData);
        setPdfDoc(null); // Ensure text view is shown
        
        await setCache(analysisKey, { outline: generatedOutline, structuredContent: structuredData });

      } catch (err: any) {
        if (err instanceof ApiLimitError) {
            setInterruptedTask({
                serviceId: 'view',
                resume: () => processFile(fileToProcess),
                context: { file: fileToProcess }
            });
        } else {
            setError(err.message || 'حدث خطأ أثناء معالجة الملف.');
            setPdfDoc(null);
            setStructuredContent([]);
        }
      } finally {
        setIsLoading(false);
        setProgress('');
      }
  };

    const goToPrevPage = useCallback(() => {
        if (!pdfDoc) return;
        setCurrentPage(p => Math.max(1, p - 1));
    }, [pdfDoc]);

    const goToNextPage = useCallback(() => {
        if (!pdfDoc) return;
        setCurrentPage(p => Math.min(pdfDoc.numPages, p - 1));
    }, [pdfDoc]);

    const handleZoomIn = useCallback(() => {
        setScale(s => Math.min(MAX_SCALE, s + SCALE_STEP));
    }, []);

    const handleZoomOut = useCallback(() => {
        setScale(s => Math.max(MIN_SCALE, s - SCALE_STEP));
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!pdfDoc) return;

            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            let handled = false;
            switch (e.key) {
                case 'ArrowRight':
                    goToNextPage();
                    handled = true;
                    break;
                case 'ArrowLeft':
                    goToPrevPage();
                    handled = true;
                    break;
                case '+':
                case '=':
                    handleZoomIn();
                    handled = true;
                    break;
                case '-':
                    handleZoomOut();
                    handled = true;
                    break;
            }

            if (handled) {
                e.preventDefault();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [pdfDoc, goToNextPage, goToPrevPage, handleZoomIn, handleZoomOut]);


  useEffect(() => {
    if (document) {
      setFile({ name: document.name } as File);
      setStructuredContent(document.content);
      setOutline(generateOutlineFromStructure(document.content));
      setIsSaved(!!document.id); // If it has an ID, it's from the DB
    }
  }, [document]);


  useEffect(() => {
    if (pdfDoc && !document) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage, renderPage, document]);
  
  const handleFileSelect = (files: File[]) => {
    if (files.length > 0) {
      const selectedFile = files[0];
       const acceptedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
        if (acceptedTypes.includes(selectedFile.type)) {
            setFile(selectedFile);
            processFile(selectedFile);
        } else {
            setError('نوع الملف غير مدعوم. الرجاء اختيار PDF, DOCX, أو TXT.');
        }
    }
  };
  
  const handleOutlineClick = (item: OutlineItem) => {
    if (pdfDoc && item.page) {
      setCurrentPage(item.page);
    } else if (item.id) {
      const element = window.document.getElementById(item.id);
      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleGoToExtractTool = () => {
    const pdfToolsService = SERVICES.find(s => s.id === 'pdf-tools');
    if (pdfToolsService && file) {
        const staged: StagedFile = Object.assign(file, {
            context: { nextServiceId: 'extract-text-from-pdf' }
        });
        setStagedFile(staged);
        onNavigateToService(pdfToolsService);
    }
  };

  const renderStructuredContent = () => {
    return structuredContent.map((item, index) => {
        if (item.type === 'heading') {
            const level = Math.max(1, Math.min(6, item.level || 2));
            const Tag = `h${level}` as React.ElementType;
            return <Tag key={index} id={`heading-${index}`}>{item.content}</Tag>;
        }
        return <p key={index}>{item.content}</p>;
    });
  };
  
  const handleReset = () => {
    setFile(null);
    setPdfDoc(null);
    setStructuredContent([]);
    setOutline([]);
    setError('');
    setIsImageBasedPdf(false);
  };


  const hasContent = pdfDoc || structuredContent.length > 0;

  if (isImageBasedPdf) {
    return (
        <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg text-center">
            <div className="mx-auto text-amber-500 mb-4 h-16 w-16 flex items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">مستند مصور</h2>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
                لا يحتوي هذا الملف على نص قابل للاستخراج مباشرة. لاستخراج النص منه، يرجى استخدام أداة "استخراج النص من PDF" المخصصة لذلك.
            </p>
            <div className="flex justify-center gap-4">
                <button onClick={handleReset} className="px-6 py-2 bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600">
                    اختيار ملف آخر
                </button>
                <button onClick={handleGoToExtractTool} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                    الذهاب إلى أداة الاستخراج
                </button>
            </div>
        </div>
    );
  }

  if (!file && !document) {
    return (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg max-w-3xl mx-auto">
            <div className="flex flex-col items-center">
            <FileUpload
                onFileSelect={handleFileSelect}
                acceptedFileTypes=".pdf,.docx,.txt"
                promptText={'اختر ملف (PDF, DOCX, TXT) لعرضه'}
            />
            {isLoading && <div className="mt-4 flex flex-col items-center gap-2"><Spinner /><p>{progress || 'جاري تحليل المستند...'}</p></div>}
            {error && <p className="mt-4 text-red-500 bg-red-100 dark:bg-red-900/50 dark:text-red-300 p-3 rounded-md w-full text-center">{error}</p>}
            </div>
        </div>
      );
  }
  
  if (structuredContent.length > 0 && !pdfDoc) {
      return (
        <ResultView
            title={`محتويات: ${file?.name}`}
            onReset={handleReset}
            canSaveToLibrary={!isSaved}
            structuredContent={structuredContent}
            fileName={file?.name}
            fileType={file?.type}
            documentType="original"
        >
          <div className="w-full h-[70vh] overflow-y-auto p-6 text-right prose prose-slate dark:prose-invert max-w-none bg-slate-50 dark:bg-slate-900 rounded-md">
              {renderStructuredContent()}
          </div>
        </ResultView>
      );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {!hasContent && isLoading ? (
         <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg max-w-3xl mx-auto">
            <div className="flex flex-col items-center">
            {isLoading && <div className="mt-4 flex flex-col items-center gap-2"><Spinner /><p>{progress || 'جاري تحليل المستند...'}</p></div>}
            {error && <p className="mt-4 text-red-500 bg-red-100 dark:bg-red-900/50 dark:text-red-300 p-3 rounded-md w-full text-center">{error}</p>}
            </div>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-8">
            <aside className="md:w-1/3 lg:w-1/4 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-lg h-full md:sticky top-8" role="region" aria-labelledby="outline-heading">
                <h3 id="outline-heading" className="text-xl font-bold mb-4 border-b dark:border-slate-600 pb-2">فهرس المحتويات</h3>
                {isLoading && !outline.length ? (
                     <div className="flex justify-center items-center p-4"><Spinner /></div>
                ) : outline.length > 0 ? (
                    <nav aria-label="التنقل في المستند">
                        <ul className="space-y-2 max-h-[70vh] overflow-y-auto">
                            {outline.map((item, index) => {
                                const isLink = !pdfDoc && item.id;
                                const itemContent = (
                                    <>
                                        {item.title} 
                                        {pdfDoc && item.page && <span className="text-sm text-slate-500 dark:text-slate-400 mr-2">(ص. {item.page})</span>}
                                    </>
                                );

                                const commonClasses = `w-full text-right p-2 rounded transition-colors text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-slate-800`;
                                const activeClasses = `bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold`;
                                const inactiveClasses = `hover:bg-slate-100 dark:hover:bg-slate-700`;
                                
                                return (
                                    <li key={index}>
                                        {isLink ? (
                                            <a 
                                                href={`#${item.id}`} 
                                                onClick={(e) => { e.preventDefault(); handleOutlineClick(item); }}
                                                className={`${commonClasses} ${inactiveClasses} block`}
                                            >
                                                {itemContent}
                                            </a>
                                        ) : (
                                            <button 
                                                onClick={() => handleOutlineClick(item)} 
                                                className={`${commonClasses} ${currentPage === item.page && pdfDoc ? activeClasses : inactiveClasses}`}
                                                aria-current={currentPage === item.page && pdfDoc ? 'page' : undefined}
                                            >
                                                {itemContent}
                                            </button>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>
                ) : <p className="text-slate-500 dark:text-slate-400">لم يتمكن الذكاء الاصطناعي من إنشاء فهرس لهذا المستند.</p>}
            </aside>
            <main className="flex-1 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-lg min-w-0" role="region" aria-labelledby="document-main-content-heading">
                <h2 id="document-main-content-heading" className="sr-only">محتوى المستند</h2>
                {pdfDoc && (
                    <div className="flex justify-between items-center mb-4 border-b dark:border-slate-600 pb-2 flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                             <button onClick={goToPrevPage} disabled={currentPage <= 1 || isLoading} className="p-2 bg-slate-200 dark:bg-slate-700 rounded disabled:opacity-50 hover:bg-slate-300 dark:hover:bg-slate-600" aria-label="الصفحة السابقة">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transform scale-x-[-1]"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                            </button>
                            <span className="font-mono text-sm" aria-live="polite" aria-atomic="true">صفحة {currentPage} من {pdfDoc.numPages}</span>
                            <button onClick={goToNextPage} disabled={currentPage >= pdfDoc.numPages || isLoading} className="p-2 bg-slate-200 dark:bg-slate-700 rounded disabled:opacity-50 hover:bg-slate-300 dark:hover:bg-slate-600" aria-label="الصفحة التالية">
                               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                             <button onClick={handleZoomOut} disabled={scale <= MIN_SCALE} className="p-2 bg-slate-200 dark:bg-slate-700 rounded disabled:opacity-50 hover:bg-slate-300 dark:hover:bg-slate-600" aria-label="تصغير">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                            </button>
                            <span className="font-mono text-sm w-16 text-center" aria-live="polite">{Math.round(scale * 100)}%</span>
                             <button onClick={handleZoomIn} disabled={scale >= MAX_SCALE} className="p-2 bg-slate-200 dark:bg-slate-700 rounded disabled:opacity-50 hover:bg-slate-300 dark:hover:bg-slate-600" aria-label="تكبير">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                            </button>
                        </div>
                    </div>
                )}
                <div className="overflow-auto max-h-[75vh] flex justify-center items-start">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full"><Spinner /><p className="mt-2">{progress}</p></div>
                    ) : pdfDoc ? (
                        <canvas ref={canvasRef} />
                    ) : (
                         <div className="w-full text-right prose prose-slate dark:prose-invert max-w-none p-4">
                            {renderStructuredContent()}
                        </div>
                    )}
                </div>
            </main>
        </div>
      )}
    </div>
  );
};

export default ViewDoc;