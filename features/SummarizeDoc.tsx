import React, { useState, useCallback, useEffect, useRef } from 'react';
import { summarizeText, summarizeImages, summarizeFileDirectly } from '../services/aiService';
import Spinner from '../components/Spinner';
import { useAppContext } from '../AppContext';
import { ApiLimitError } from '../services/aiService';
import FileUpload from '../components/FileUpload';
import ResultView from '../components/ResultView';
import { Service, StructuredContentItem, Template } from '../types';
import ConfirmationModal from '../components/ConfirmationModal';
import { extractTextFromFile } from '../services/textExtractorService';
import * as notificationService from '../services/notificationService';
import { getTemplates } from '../services/settingsService';

interface SummarizeDocProps {
  onSelectService: (service: Service) => void;
}

const SummarizeDoc: React.FC<SummarizeDocProps> = ({ onSelectService }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [summaryType, setSummaryType] = useState('points');
  const { setInterruptedTask, interruptedTask, clearInterruptedTask, stagedFile, setStagedFile } = useAppContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // New state for PDF fallback mechanism
  const [showPdfFallbackModal, setShowPdfFallbackModal] = useState(false);
  const [pdfFallbackContext, setPdfFallbackContext] = useState<{ file: File; summaryType: string } | null>(null);
  
  // Templates state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  useEffect(() => {
      setTemplates(getTemplates().filter(t => t.type === 'summary'));
  }, []);

  useEffect(() => {
    if (stagedFile) {
      handleFileSelect([stagedFile]);
      setStagedFile(null);
    }
  }, [stagedFile, setStagedFile]);
  

  const summarizeAsImages = async (fileToProcess: File, summaryType: string) => {
    setIsLoading(true);
    setError('');
    setProgress('الملف قائم على الصور، جاري استخراج الصور (هذا قد يستغرق وقتاً)...');
    try {
        const globalPdfjsLib = (window as any).pdfjsLib;
        if (!globalPdfjsLib) throw new Error("مكتبة PDF.js لم يتم تحميلها. يرجى تحديث الصفحة.");

        if (!canvasRef.current) throw new Error("Canvas element is not available for image extraction.");
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) throw new Error("Canvas context is not available.");

        const arrayBuffer = await fileToProcess.arrayBuffer();
        const pdf = await globalPdfjsLib.getDocument({ data: arrayBuffer, verbosity: 1 }).promise;
        const imageParts = [];
        
        const maxPagesToProcess = 100;
        const numPages = pdf.numPages;
        const pagesToProcess = Math.min(numPages, maxPagesToProcess);

        if (numPages > maxPagesToProcess) {
            setProgress(`الملف كبير جداً، سيتم تلخيص أول ${maxPagesToProcess} صفحة فقط.`);
            await new Promise(resolve => setTimeout(resolve, 2500));
        }

        for (let i = 1; i <= pagesToProcess; i++) {
            setProgress(`جاري معالجة صورة الصفحة ${i} من ${pagesToProcess}...`);
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 });
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            const base64Data = dataUrl.split(',')[1];
            imageParts.push({ inlineData: { data: base64Data, mimeType: 'image/jpeg' } });
        }

        if (imageParts.length === 0) {
            throw new Error("لم يتم العثور على صفحات قابلة للمعالجة في ملف PDF.");
        }
        setProgress('جاري تلخيص الصور...');
        const result = await summarizeImages(imageParts, summaryType);
        setSummary(result);
        notificationService.notify('✅ اكتمل تلخيص المستند!', {
            body: `تم تلخيص ملفك "${fileToProcess.name}" بنجاح.`,
        });
    } catch (err: any) {
        if (err instanceof ApiLimitError) {
            setInterruptedTask({
                serviceId: 'summarize-as-images',
                resume: () => summarizeAsImages(fileToProcess, summaryType),
                context: {}
            });
        } else {
            setError(err.message || 'حدث خطأ غير متوقع أثناء معالجة الصور.');
            setFile(null);
            notificationService.notify('❌ فشل تلخيص المستند', {
                body: `حدث خطأ أثناء تلخيص ملفك "${fileToProcess.name}".`,
            });
        }
    } finally {
        setIsLoading(false);
        setProgress('');
    }
  };

  const handleConfirmSummarizeAsImages = () => {
    if (pdfFallbackContext) {
        summarizeAsImages(pdfFallbackContext.file, pdfFallbackContext.summaryType);
    }
    setShowPdfFallbackModal(false);
    setPdfFallbackContext(null);
  };

  const resumableHandleSubmit = async (currentFile: File, currentSummaryType: string) => {
    if (!currentFile) {
      setError('الرجاء اختيار ملف أولاً.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSummary('');
    setProgress('');
    if (interruptedTask) clearInterruptedTask();

    try {
      const text = await extractTextFromFile(currentFile, setProgress);
      let result = '';

      // If using a template, override the type
      let activePromptType = currentSummaryType;
      if (selectedTemplateId) {
          const template = templates.find(t => t.id === selectedTemplateId);
          if (template) {
              // We pass the custom prompt text, handled in aiService if it detects it's custom
              activePromptType = `TEMPLATE:${template.prompt}`; 
          }
      }

      if(!text.trim()){
        if (currentFile.type === 'application/pdf') {
            const base64Data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(currentFile);
                reader.onload = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = error => reject(error);
            });
            const pdfPart = {
                inlineData: {
                    data: base64Data,
                    mimeType: 'application/pdf'
                }
            };
            try {
                setProgress('جاري محاولة تحليل الملف مباشرة...');
                result = await summarizeFileDirectly(pdfPart, activePromptType);
                setSummary(result);
            } catch (directError: any) {
                if (directError.message.includes("لا يدعم تحليل ملفات PDF مباشرة")) {
                    setPdfFallbackContext({ file: currentFile, summaryType: activePromptType });
                    setShowPdfFallbackModal(true);
                    setIsLoading(false);
                    return; // Stop execution, wait for user input from modal
                }
                // For other errors, re-throw to be caught by the outer catch block
                throw directError;
            }
        } else {
            throw new Error("لم يتمكن من استخراج النص من المستند، قد يكون ملفًا قائمًا على الصور أو فارغًا. هذه الميزة تدعم حاليًا ملفات PDF المصورة فقط.");
        }
      } else {
        result = await summarizeText(text, activePromptType, setProgress);
        setSummary(result);
      }
      notificationService.notify('✅ اكتمل تلخيص المستند!', {
        body: `تم تلخيص ملفك "${currentFile.name}" بنجاح.`,
      });
    } catch (err: any) {
        if (err instanceof ApiLimitError) {
            setInterruptedTask({
                serviceId: 'summarize',
                resume: (context) => resumableHandleSubmit(context.file, context.summaryType),
                context: { file: currentFile, summaryType: currentSummaryType }
            });
        } else {
            setError(err.message || 'حدث خطأ غير متوقع. قد يكون الملف فارغًا أو محميًا بكلمة مرور.');
            setFile(null); // Reset on error
            notificationService.notify('❌ فشل تلخيص المستند', {
                body: `حدث خطأ أثناء تلخيص ملفك "${currentFile.name}".`,
            });
        }
    } finally {
        if (!showPdfFallbackModal) {
          setIsLoading(false);
          setProgress('');
        }
    }
  };

  const handleSubmit = () => {
    if (file) {
      resumableHandleSubmit(file, summaryType);
    }
  }

  const handleFileSelect = (files: File[]) => {
    if (files.length > 0) {
        const selectedFile = files[0];
        const acceptedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
        if (acceptedTypes.includes(selectedFile.type)) {
            setFile(selectedFile);
            setSummary('');
            setError('');
        } else {
            setError('نوع الملف غير مدعوم. الرجاء اختيار PDF, DOCX, أو TXT.');
        }
    }
  };
  
  const handleReset = () => {
    setFile(null);
    setSummary('');
    setError('');
    setProgress('');
    setSummaryType('points');
    setSelectedTemplateId('');
  };

  if (summary && file) {
    const structuredContent: StructuredContentItem[] = [{ type: 'paragraph', content: summary }];
    return (
        <ResultView 
            title={`ملخص لـ: ${file.name}`}
            onReset={handleReset}
            canSaveToLibrary={true}
            structuredContent={structuredContent}
            fileName={`ملخص - ${file.name}`}
            fileType={file.type}
            documentType="summary"
            sourceFileName={file.name}
        >
             <div className="prose prose-slate dark:prose-invert max-w-none text-right" dangerouslySetInnerHTML={{ __html: summary.replace(/\n/g, '<br />') }} />
        </ResultView>
    );
  }

  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg">
      <canvas ref={canvasRef} className="hidden"></canvas>
      <div className="flex flex-col items-center">
        <FileUpload
            onFileSelect={handleFileSelect}
            acceptedFileTypes=".pdf,.docx,.txt"
            promptText={file ? file.name : 'اسحب وأفلت ملف (PDF, DOCX, TXT) هنا أو انقر للاختيار'}
        />

        <div className="mt-6 w-full">
          <fieldset>
            <legend className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-3 text-center">اختر أسلوب التلخيص</legend>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center mb-4">
              <div>
                <input type="radio" id="type-points" name="summaryType" value="points" checked={summaryType === 'points' && !selectedTemplateId} onChange={(e) => { setSummaryType(e.target.value); setSelectedTemplateId(''); }} className="sr-only" />
                <label htmlFor="type-points" className="block p-3 border-2 rounded-lg cursor-pointer transition-colors border-slate-300 dark:border-slate-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700 has-[:checked]:bg-blue-100 dark:has-[:checked]:bg-blue-900/50 has-[:checked]:border-blue-600 font-semibold">
                  نقاط رئيسية
                </label>
              </div>
              <div>
                <input type="radio" id="type-short" name="summaryType" value="short" checked={summaryType === 'short' && !selectedTemplateId} onChange={(e) => { setSummaryType(e.target.value); setSelectedTemplateId(''); }} className="sr-only" />
                <label htmlFor="type-short" className="block p-3 border-2 rounded-lg cursor-pointer transition-colors border-slate-300 dark:border-slate-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700 has-[:checked]:bg-blue-100 dark:has-[:checked]:bg-blue-900/50 has-[:checked]:border-blue-600 font-semibold">
                  ملخص قصير
                </label>
              </div>
              <div>
                <input type="radio" id="type-detailed" name="summaryType" value="detailed" checked={summaryType === 'detailed' && !selectedTemplateId} onChange={(e) => { setSummaryType(e.target.value); setSelectedTemplateId(''); }} className="sr-only" />
                <label htmlFor="type-detailed" className="block p-3 border-2 rounded-lg cursor-pointer transition-colors border-slate-300 dark:border-slate-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700 has-[:checked]:bg-blue-100 dark:has-[:checked]:bg-blue-900/50 has-[:checked]:border-blue-600 font-semibold">
                  ملخص مفصل
                </label>
              </div>
              <div>
                <input type="radio" id="type-simple" name="summaryType" value="simple" checked={summaryType === 'simple' && !selectedTemplateId} onChange={(e) => { setSummaryType(e.target.value); setSelectedTemplateId(''); }} className="sr-only" />
                <label htmlFor="type-simple" className="block p-3 border-2 rounded-lg cursor-pointer transition-colors border-slate-300 dark:border-slate-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700 has-[:checked]:bg-blue-100 dark:has-[:checked]:bg-blue-900/50 has-[:checked]:border-blue-600 font-semibold">
                  شرح مبسط
                </label>
              </div>
            </div>
            {templates.length > 0 && (
                 <div className="mt-2">
                    <label htmlFor="template-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">أو اختر قالباً مخصصاً:</label>
                    <select 
                        id="template-select"
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800"
                    >
                        <option value="">-- اختر من القوالب --</option>
                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                 </div>
            )}
          </fieldset>
        </div>

        <button
          id="primary-action-button"
          title="Cmd/Ctrl + Enter"
          onClick={handleSubmit}
          disabled={isLoading || !file}
          className="mt-6 bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center w-48"
        >
          {isLoading ? <Spinner /> : 'تلخيص الآن'}
        </button>
        
        {isLoading && progress && <p role="status" className="mt-4 text-slate-600 dark:text-slate-300 text-center">{progress}</p>}
        {error && <p role="alert" className="mt-4 text-red-500 bg-red-100 dark:bg-red-900/50 dark:text-red-300 p-3 rounded-md w-full text-center">{error}</p>}
      </div>
      <ConfirmationModal
          isOpen={showPdfFallbackModal}
          title="المزود لا يدعم الملف"
          message={`مزود الخدمة المحدد لا يدعم تحليل ملفات PDF مباشرة. \n\nهل تود المتابعة عن طريق تحويل صفحات الملف إلى صور وتلخيصها؟`}
          onConfirm={handleConfirmSummarizeAsImages}
          onCancel={() => { setShowPdfFallbackModal(false); setPdfFallbackContext(null); }}
          confirmText="نعم، حول إلى صور"
          cancelText="إلغاء"
      />
    </div>
  );
};

export default SummarizeDoc;