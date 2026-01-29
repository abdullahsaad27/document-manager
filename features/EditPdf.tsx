import React, { useState, useRef, useEffect } from 'react';
import Spinner from '../components/Spinner';
import EditPageModal from './EditPageModal';
import type { PageState, TextEdit, TextItem } from '../types';
import { useAppContext } from '../AppContext';
import FileUpload from '../components/FileUpload';
import { getCache, setCache, initDB } from '../services/database';

declare const pdfjsLib: any;
declare const PDFLib: any;
declare const fontkit: any;

type EditMode = 'visual' | 'form';

const EditPdf: React.FC = () => {
  const { interruptedTask, setInterruptedTask, clearInterruptedTask } = useAppContext();
  
  const [file, setFile] = useState<File | null>(interruptedTask?.context?.file || null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pages, setPages] = useState<PageState[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [editMode, setEditMode] = useState<EditMode>('visual');
  const [editingPageIndex, setEditingPageIndex] = useState<number | null>(interruptedTask?.context?.editingPageIndex ?? null);
  const [pageToEdit, setPageToEdit] = useState<any>(null);
  
  useEffect(() => {
    initDB();
  }, []);

  const generateFileKey = (file: File) => `pdf-edit-previews-${file.name}-${file.size}-${file.lastModified}`;

  const processFile = async (fileToProcess: File) => {
    setIsLoading(true);
    setLoadingMessage('جاري تحليل وعرض الصفحات...');
    setPages([]);
    setError('');

    const fileKey = generateFileKey(fileToProcess);

    try {
        const cachedPages = await getCache(fileKey);
        if (cachedPages) {
            console.log("Loading previews from cache...");
             const { PDFDocument } = PDFLib;
            const arrayBuffer = await fileToProcess.arrayBuffer();

            // Advanced reconstruction to handle potentially corrupt files
            setLoadingMessage('جاري إصلاح بنية المستند...');
            let repairedBytes;
            try {
                const originalDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
                const newDoc = await PDFDocument.create();
                const copiedPages = await newDoc.copyPages(originalDoc, originalDoc.getPageIndices());
                copiedPages.forEach(page => newDoc.addPage(page));
                try {
                    const form = newDoc.getForm();
                    if (form.getFields().length > 0) form.flatten();
                } catch(e) { /* ignore */ }
                repairedBytes = await newDoc.save();
            } catch (repairError) {
                 throw new Error("فشل في معالجة ملف PDF. قد يكون الملف تالفًا أو غير متوافق.");
            }
            
            const pdf = await pdfjsLib.getDocument({ data: repairedBytes, verbosity: 1 }).promise;
            setPdfDoc(pdf);
            setPages(cachedPages);
            setIsLoading(false);
            setLoadingMessage('');
            return;
        }
    } catch (e: any) {
        if (e.message.includes("فشل في معالجة ملف PDF")) {
            setError(e.message);
            setIsLoading(false);
            return;
        }
        console.warn("Could not read from cache, proceeding with normal processing.", e);
    }


    try {
      const { PDFDocument } = PDFLib;
      const arrayBuffer = await fileToProcess.arrayBuffer();
      
      // Advanced reconstruction to handle potentially corrupt files
      setLoadingMessage('جاري إصلاح بنية المستند...');
      let repairedBytes;
      try {
          const originalDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
          const newDoc = await PDFDocument.create();
          const copiedPages = await newDoc.copyPages(originalDoc, originalDoc.getPageIndices());
          copiedPages.forEach(page => newDoc.addPage(page));
          try {
              const form = newDoc.getForm();
              if (form.getFields().length > 0) form.flatten();
          } catch(e) { /* ignore */ }
          repairedBytes = await newDoc.save();
      } catch (repairError) {
           throw new Error("فشل في معالجة ملف PDF. قد يكون الملف تالفًا أو غير متوافق.");
      }


      const pdf = await pdfjsLib.getDocument({ data: repairedBytes, verbosity: 1 }).promise;
      setPdfDoc(pdf);
      const numPages = pdf.numPages;
      const newPages: PageState[] = [];
      
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Canvas element not found.');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Failed to get canvas context.');

      for (let i = 1; i <= numPages; i++) {
        setLoadingMessage(`جاري معالجة الصفحة ${i} من ${numPages}...`);
        const page = await pdf.getPage(i);
        
        const viewportThumb = page.getViewport({ scale: 0.5 });
        canvas.height = viewportThumb.height;
        canvas.width = viewportThumb.width;
        await page.render({ canvasContext: context, viewport: viewportThumb }).promise;
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        const textContent = await page.getTextContent();
        const textItems: TextItem[] = textContent.items.map((item: any, index: number) => ({
          id: `${i-1}-${index}`,
          str: item.str,
          transform: item.transform,
          width: item.width,
          height: item.height,
          dir: item.dir,
        }));
        
        newPages.push({
          thumbnailUrl,
          rotation: 0,
          isDeleted: false,
          textItems,
          edits: {},
          hasText: textItems.length > 0,
        });
      }
      setPages(newPages);
      try {
        await setCache(fileKey, newPages);
        console.log("Previews saved to cache.");
      } catch (e) {
          console.warn("Could not save previews to cache.", e);
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء معالجة الملف.');
      setPdfDoc(null);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };
  
  useEffect(() => {
    if (file && pages.length === 0) {
        processFile(file);
    }
  }, [file]);

  useEffect(() => {
    if (editingPageIndex !== null && pdfDoc) {
        pdfDoc.getPage(editingPageIndex + 1).then(setPageToEdit);
    } else {
        setPageToEdit(null);
    }
  }, [editingPageIndex, pdfDoc]);

  const handleFileSelect = (files: File[]) => {
    const selectedFile = files?.[0];
    if (!selectedFile) return;

    if (selectedFile.type !== 'application/pdf') {
      setError('الرجاء اختيار ملف PDF فقط.');
      return;
    }

    setFile(selectedFile);
  };
  
  const handleEditTextClick = (index: number) => {
    if (!pages[index].hasText) {
      alert('هذه الصفحة لا تحتوي على نص قابل للاستخراج. قد تكون صورة.');
      return;
    }
    setEditingPageIndex(index);
  };

  const handleRotate = (index: number) => {
    setPages(prevPages => {
      const newPages = [...prevPages];
      const currentPage = newPages[index];
      currentPage.rotation = ((currentPage.rotation + 90) % 360) as 0 | 90 | 180 | 270;
      return newPages;
    });
  };

  const handleDelete = (index: number) => {
    setPages(prevPages => {
      const newPages = [...prevPages];
      newPages[index].isDeleted = !newPages[index].isDeleted;
      return newPages;
    });
  };
  
  const handleSaveEdits = (pageIndex: number, newEdits: TextEdit, formText?: string) => {
    setPages(prev => {
        const newPages = [...prev];
        if (formText !== undefined) {
          newPages[pageIndex].formTextEdit = formText;
          newPages[pageIndex].edits = {};
        } else {
          newPages[pageIndex].edits = newEdits;
          newPages[pageIndex].formTextEdit = undefined;
        }
        return newPages;
    });
    setEditingPageIndex(null);
  };

  const handleApplyChanges = async () => {
    if (!file) return;

    setIsLoading(true);
    setLoadingMessage('جاري تطبيق التغييرات...');
    setError('');

    try {
      const { PDFDocument, degrees, rgb, StandardFonts } = PDFLib;
      const existingPdfBytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(existingPdfBytes, { ignoreEncryption: true });
      
      pdfDoc.registerFontkit(fontkit);

      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      let cairoFont: any = null;
      const needsCairoFont = pages.some(p => !!p.formTextEdit);
      if (needsCairoFont) {
          setLoadingMessage('جاري تحميل الخط العربي...');
          const fontUrl = 'https://fonts.gstatic.com/s/cairo/v28/SLXgc1nY6HkvangtZmpQdkh-SCpsapi-.ttf';
          const fontBytes = await fetch(fontUrl).then(res => res.arrayBuffer());
          cairoFont = await pdfDoc.embedFont(fontBytes);
      }

      const pageIndices = pdfDoc.getPageIndices();
      
      for (let i = 0; i < pages.length; i++) {
        setLoadingMessage(`جاري معالجة تعديلات الصفحة ${i + 1}...`);
        const pageState = pages[i];
        const pdfPage = pdfDoc.getPage(pageIndices[i]);
        const { width: pageWidth, height: pageHeight } = pdfPage.getSize();
            
        if (pageState.formTextEdit && cairoFont) {
            pdfPage.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(1, 1, 1) });
            const lines = pageState.formTextEdit.split('\n');
            const fontSize = 12;
            const margin = 50;
            pdfPage.drawText(lines.join('\n'), { x: margin, y: pageHeight - margin, font: cairoFont, size: fontSize, lineHeight: fontSize + 4, color: rgb(0, 0, 0) });
        } else if (Object.keys(pageState.edits).length > 0) {
            for(const textItemId in pageState.edits) {
                const newText = pageState.edits[textItemId];
                const originalTextItem = pageState.textItems.find(item => item.id === textItemId);
                if (originalTextItem) {
                    const { transform, width, height } = originalTextItem;
                    const x = transform[4];
                    const y = pageHeight - transform[5];
                    
                    pdfPage.drawRectangle({ x: x - 1, y: y - (height / 4), width: width + 2, height: height + (height / 2), color: rgb(1, 1, 1) });
                    pdfPage.drawText(newText, { x: x, y: y, font: helveticaFont, size: height, color: rgb(0, 0, 0) });
                }
            }
        }
      }

      const newPdfDoc = await PDFDocument.create();
      for (let i = 0; i < pages.length; i++) {
        if (!pages[i].isDeleted) {
          const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageIndices[i]]);
          copiedPage.setRotation(degrees(pages[i].rotation));
          newPdfDoc.addPage(copiedPage);
        }
      }

      if (newPdfDoc.getPageCount() === 0) {
        throw new Error('لا يمكن حفظ ملف فارغ. يجب أن تبقى صفحة واحدة على الأقل.');
      }

      const pdfBytes = await newPdfDoc.save();
      
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `edited-${file.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      setFile(null);
      setPdfDoc(null);
      setPages([]);
      clearInterruptedTask();

    } catch (err: any) {
      setError(err.message || 'فشل تطبيق التغييرات. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const activePagesCount = pages.filter(p => !p.isDeleted).length;

  return (
    <div className="max-w-5xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg">
      <canvas ref={canvasRef} className="hidden"></canvas>
      
      {!file || pages.length === 0 && !isLoading ? (
        <div className="flex flex-col items-center">
            <FileUpload
                onFileSelect={handleFileSelect}
                acceptedFileTypes=".pdf"
                promptText={file ? file.name : 'اسحب وأفلت ملف PDF هنا أو انقر للاختيار'}
            />
        </div>
      ) : (
        !isLoading && pages.length > 0 && (
            <div>
            <div className="flex justify-between items-center mb-6 border-b dark:border-slate-700 pb-4 flex-wrap gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 truncate" title={file?.name}>{file?.name}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{pages.length} صفحة</p>
                </div>
                 <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
                    <button onClick={() => setEditMode('visual')} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${editMode === 'visual' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>الوضع المرئي</button>
                    <button onClick={() => setEditMode('form')} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${editMode === 'form' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>وضع النموذج</button>
                </div>
                <button
                id="primary-action-button"
                title="Cmd/Ctrl + Enter"
                onClick={handleApplyChanges}
                disabled={isLoading || activePagesCount === 0}
                className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center min-w-[160px]"
                >
                {isLoading ? <Spinner /> : `تطبيق وحفظ (${activePagesCount})`}
                </button>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {pages.map((page, index) => (
                <div key={index}
                     aria-label={`صفحة ${index + 1}${page.isDeleted ? ' (محذوفة)' : ''}`}
                     className={`relative border-2 rounded-lg overflow-hidden transition-all duration-300 shadow-sm group ${page.isDeleted ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'}`}>
                    <img
                    src={page.thumbnailUrl}
                    alt={`صورة مصغرة للصفحة ${index + 1}`}
                    className={`w-full h-auto transition-all duration-200 ${page.isDeleted ? 'opacity-30' : ''}`}
                    style={{ transform: `rotate(${page.rotation}deg)` }}
                    />
                    {page.isDeleted && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-500 bg-opacity-50">
                        <span className="text-white font-bold text-lg">محذوفة</span>
                    </div>
                    )}
                    <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button aria-label={`تعديل نص الصفحة ${index + 1}`} onClick={() => handleEditTextClick(index)} className="p-1.5 bg-white/80 dark:bg-slate-800/80 rounded-full shadow hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-50" disabled={page.isDeleted}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                      </button>
                      <button aria-label={`تدوير الصفحة ${index + 1}`} onClick={() => handleRotate(index)} className="p-1.5 bg-white/80 dark:bg-slate-800/80 rounded-full shadow hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-50" disabled={page.isDeleted}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 2v6h6M21.5 22v-6h-6"/><path d="M22 11.5A10 10 0 0 0 3.5 12.5"/></svg>
                      </button>
                      <button aria-label={page.isDeleted ? `استعادة الصفحة ${index + 1}` : `حذف الصفحة ${index + 1}`} onClick={() => handleDelete(index)} className={`p-1.5 rounded-full shadow transition-colors ${page.isDeleted ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-red-500 text-white hover:bg-red-600'}`}>
                        {page.isDeleted ? 
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9H5.83a2 2 0 0 0-1.42 3.42l5.14 5.14a2 2 0 0 0 2.84 0L19 12"/></svg>
                          : <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        }
                      </button>
                    </div>
                    <div className="absolute bottom-1 left-1 bg-slate-800/70 text-white text-xs font-bold px-2 py-0.5 rounded">
                    {index + 1}
                    </div>
                </div>
                ))}
            </div>
            </div>
        )
      )}

      {isLoading && loadingMessage && (
        <div className="mt-4 flex flex-col items-center gap-2" role="status">
            <Spinner />
            <p className="text-slate-600 dark:text-slate-300">{loadingMessage}</p>
        </div>
      )}
      {error && <p role="alert" className="mt-4 text-red-500 bg-red-100 dark:bg-red-900/50 dark:text-red-300 p-3 rounded-md w-full text-center">{error}</p>}
      
      {editingPageIndex !== null && pageToEdit && (
        <EditPageModal
            pageState={pages[editingPageIndex]}
            pdfPage={pageToEdit}
            pageNumber={editingPageIndex + 1}
            onClose={() => setEditingPageIndex(null)}
            onSave={handleSaveEdits}
            mode={editMode}
            setInterruptedTask={setInterruptedTask}
            file={file}
        />
      )}
    </div>
  );
};

export default EditPdf;