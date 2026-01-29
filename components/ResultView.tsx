import React, { useState, useMemo } from 'react';
import type { Service, StructuredContentItem } from '../types';
import { initDB, saveDocument } from '../services/database';
import { saveFile } from '../services/platformService';

interface ResultViewProps {
  title: string;
  file?: File | null;
  onReset: () => void;
  nextSteps?: Service[];
  onNextStep?: (service: Service, file: File) => void;
  children?: React.ReactNode;
  canSaveToLibrary?: boolean;
  structuredContent?: StructuredContentItem[];
  fileName?: string;
  fileType?: string;
  documentType?: 'original' | 'summary' | 'analysis';
  sourceFileName?: string;
}

const ResultView: React.FC<ResultViewProps> = ({ 
    title, file, onReset, nextSteps, onNextStep, children, 
    canSaveToLibrary, structuredContent, fileName, fileType, documentType, sourceFileName 
}) => {

  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');

  const textContent = useMemo(() => {
    if (!structuredContent) return '';
    return structuredContent.map(item => item.content).join('\n\n');
  }, [structuredContent]);

  const handleDownload = async () => {
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      await saveFile(file.name, buffer);
    } catch (error) {
        console.error("Download failed:", error);
        alert("Could not download the file.");
    }
  };
  
  const handleSaveToLibrary = async () => {
    if (!structuredContent || !fileName || !fileType) return;
    try {
        await initDB();
        await saveDocument({
            name: fileName,
            fileType: fileType,
            content: structuredContent,
            createdAt: new Date(),
            documentType,
            sourceFileName,
        });
        setIsSaved(true);
    } catch (e) {
        setSaveError("فشل حفظ المستند في المكتبة.");
    }
  };

  const handleCopy = () => {
    if (!textContent) return;
    navigator.clipboard.writeText(textContent).then(() => {
        setCopyStatus('تم النسخ!');
        setTimeout(() => setCopyStatus(''), 2000);
    }).catch(err => {
        setCopyStatus('فشل النسخ');
        console.error("فشل النسخ: ", err);
    });
  };

  const handleExportTxt = async () => {
    if (!textContent || !fileName) return;
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const buffer = new Uint8Array(await blob.arrayBuffer());
    await saveFile(`${fileName.split('.')[0]}.txt`, buffer);
  };

  const handleExportDocx = async () => {
    if (!structuredContent || structuredContent.length === 0 || !fileName) return;

    const docx = (window as any).docx;
    if (!docx || !docx.Document || !docx.Paragraph || !docx.Packer) {
        alert("مكتبة تصدير Word غير متاحة أو لم يتم تحميلها بالكامل. يرجى التحقق من اتصالك بالإنترنت وتحديث الصفحة.");
        return;
    }

    try {
        const children = structuredContent.map(item => {
            if (item.type === 'heading') {
                const level = Math.max(1, Math.min(6, item.level || 2));
                return new docx.Paragraph({
                    text: item.content,
                    heading: docx.HeadingLevel[`HEADING_${level}`] || `Heading${level}`,
                    bidirectional: true,
                });
            }
            return new docx.Paragraph({
                text: item.content,
                bidirectional: true,
            });
        });

        const doc = new docx.Document({
            sections: [{ children }],
        });

        const blob = await docx.Packer.toBlob(doc);
        const buffer = new Uint8Array(await blob.arrayBuffer());
        await saveFile(`${fileName.split('.')[0]}.docx`, buffer);
    } catch (e: any) {
        alert(`حدث خطأ أثناء التصدير: ${e.message}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg text-center">
      <div className="mx-auto text-green-500 mb-4 h-16 w-16 flex items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      </div>
      <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">{title}</h2>
      
      {children && <div className="my-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border dark:border-slate-700">{children}</div>}

      <div className="flex flex-wrap justify-center items-center gap-4 my-6">
        {file && (
          <button onClick={handleDownload} className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>تحميل النتيجة</span>
          </button>
        )}
         {canSaveToLibrary && (
             <div role="status">
                <button onClick={handleSaveToLibrary} disabled={isSaved} className="bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center gap-2">
                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                    <span>{isSaved ? 'تم الحفظ!' : 'حفظ إلى المكتبة'}</span>
                </button>
                {saveError && <p role="alert" className="text-red-500 text-sm mt-1">{saveError}</p>}
             </div>
         )}
        {structuredContent && textContent && (
          <>
            <button
              onClick={handleCopy}
              className="bg-teal-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>{copyStatus || 'نسخ النص'}</span>
            </button>
            <button
              onClick={handleExportTxt}
              className="bg-slate-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-slate-600 transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
              <span>تصدير كـ TXT</span>
            </button>
            <button
              onClick={handleExportDocx}
              className="bg-sky-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-sky-700 transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-7.5a2.5 2.5 0 0 1 5 0V18"/><path d="M12 18H7.5a2.5 2.5 0 1 1 0-5H12"/></svg>
              <span>تصدير كـ DOCX</span>
            </button>
          </>
        )}
        <button onClick={onReset} className="bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-slate-100 font-bold py-3 px-6 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">
          البدء من جديد
        </button>
      </div>

      {nextSteps && onNextStep && file && nextSteps.length > 0 && (
        <div className="mt-8 border-t dark:border-slate-700 pt-6">
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-4">الخطوات التالية المقترحة:</h3>
          <div className="flex flex-wrap justify-center gap-3">
            {nextSteps.map(service => (
              <button 
                key={service.id} 
                onClick={() => onNextStep(service, file)}
                className="bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
              >
                {React.cloneElement(service.icon as React.ReactElement, { width: 18, height: 18, 'aria-hidden': true })}
                {service.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultView;