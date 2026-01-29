import React, { useState, useEffect } from 'react';
import Spinner from '../components/Spinner';
import FileUpload from '../components/FileUpload';
import { processPdf } from '../services/pdfProcessor';
import ResultView from '../components/ResultView';
import { useAppContext } from '../AppContext';
import { Service } from '../types';

declare const PDFLib: any;
declare const pdfjsLib: any;

interface PageRange {
  from: number;
  to: number;
}

interface SplitPdfProps {
  onSelectService: (service: Service) => void;
}

const SplitPdf: React.FC<SplitPdfProps> = ({ onSelectService }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalPages, setTotalPages] = useState(0);
  const [ranges, setRanges] = useState<PageRange[]>([]);
  const [resultFile, setResultFile] = useState<File | null>(null);
  const [progress, setProgress] = useState('');
  
  const { stagedFile, setStagedFile } = useAppContext();

  useEffect(() => {
    if (stagedFile) {
      handleFileSelect([stagedFile]);
      setStagedFile(null);
    }
  }, [stagedFile, setStagedFile]);

  const [nextRange, setNextRange] = useState<PageRange>({ from: 1, to: 1 });

  const handleFileSelect = async (files: File[]) => {
    if (files.length > 0) {
      const selectedFile = files[0];
       if (selectedFile.type !== 'application/pdf') {
        setError('الرجاء اختيار ملف PDF فقط.');
        return;
      }
      setFile(selectedFile);
      setError('');
      setRanges([]);
      setIsLoading(true);
      setProgress('جاري قراءة الملف...');

      try {
        const { PDFDocument } = PDFLib;
        const arrayBuffer = await selectedFile.arrayBuffer();
        
        // Advanced reconstruction to handle potentially corrupt files
        setProgress('جاري إصلاح بنية المستند...');
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
        const numPages = pdf.numPages;
        setTotalPages(numPages);
        setNextRange({ from: 1, to: numPages });
      } catch (err: any) {
        setError(err.message || 'فشل في قراءة ملف PDF. قد يكون الملف تالفًا.');
        setFile(null);
        setTotalPages(0);
      } finally {
        setIsLoading(false);
        setProgress('');
      }
    }
  };
  
  const calculateNextAvailableRange = (currentRanges: PageRange[]): PageRange => {
    if (currentRanges.length === 0) {
      return { from: 1, to: totalPages };
    }
    const maxPage = Math.max(...currentRanges.map(r => r.to));
    const nextStart = maxPage + 1;
    if (nextStart > totalPages) {
      return { from: totalPages + 1, to: totalPages }; // Indicates no more pages available
    }
    return { from: nextStart, to: totalPages };
  };

  const handleAddRange = () => {
    if (nextRange.from > nextRange.to) {
      setError('صفحة البداية يجب أن تكون أصغر من أو تساوي صفحة النهاية.');
      return;
    }
    if (nextRange.from < 1 || nextRange.to > totalPages) {
      setError(`أرقام الصفحات يجب أن تكون بين 1 و ${totalPages}.`);
      return;
    }
    setError('');
    
    const newRanges = [...ranges, { from: nextRange.from, to: nextRange.to }].sort((a,b) => a.from - b.from);
    setRanges(newRanges);
    
    const nextAvailable = calculateNextAvailableRange(newRanges);
    setNextRange(nextAvailable);
  };

  const removeRange = (indexToRemove: number) => {
    const newRanges = ranges.filter((_, index) => index !== indexToRemove);
    setRanges(newRanges);
    
    const nextAvailable = calculateNextAvailableRange(newRanges);
    setNextRange(nextAvailable);
  };

  const handleSplit = async () => {
    if (!file || ranges.length === 0) {
      setError('الرجاء إضافة نطاق واحد على الأقل للتقسيم.');
      return;
    }
    setIsLoading(true);
    setError('');
    setProgress('جاري بدء عملية التقسيم...');
    try {
      const resultBlob = await processPdf({ operation: 'split', file, ranges }, setProgress);
      const newFile = new File([resultBlob], `split-${file.name.replace(/\.pdf$/i, '')}.zip`, { type: 'application/zip' });
      setResultFile(newFile);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'حدث خطأ غير متوقع.';
      setError(`فشل تقسيم الملف: ${message}`);
      console.error(err);
    } finally {
      setIsLoading(false);
      setProgress('');
    }
  };
  
  const handleReset = () => {
    setFile(null);
    setTotalPages(0);
    setRanges([]);
    setResultFile(null);
    setError('');
  };

  const isMoreRangesPossible = nextRange.from <= totalPages;

  if (resultFile) {
    return (
        <ResultView
            title="اكتمل التقسيم بنجاح!"
            file={resultFile}
            onReset={handleReset}
        />
    );
  }

  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg">
      <div className="flex flex-col items-center">
        {!file ? (
          <FileUpload
            onFileSelect={handleFileSelect}
            acceptedFileTypes=".pdf"
            promptText="اسحب وأفلت ملف PDF هنا أو انقر للاختيار"
          />
        ) : (
          <div className="w-full">
            <div className="text-center mb-6">
              <p className="font-bold text-lg text-slate-800 dark:text-slate-100">{file.name}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">إجمالي الصفحات: {totalPages}</p>
            </div>

            {ranges.length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-2">النطاقات المحددة:</h3>
                <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {ranges.map((range, index) => (
                    <li key={index} className="flex justify-between items-center p-2 bg-slate-100 dark:bg-slate-700 rounded-md">
                      <span className="font-mono text-sm text-slate-800 dark:text-slate-200">النطاق {index + 1}: من صفحة {range.from} إلى {range.to}</span>
                       <button onClick={() => removeRange(index)} className="text-red-500 hover:text-red-700 p-1" aria-label={`حذف النطاق من ${range.from} إلى ${range.to}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="border-t dark:border-slate-600 pt-4">
               <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-2">إضافة نطاق جديد:</h3>
              <div className="flex items-center gap-4">
                  <div className="flex-1">
                      <label htmlFor="from-page" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">من صفحة</label>
                      <input
                          type="number"
                          id="from-page"
                          min="1"
                          max={totalPages}
                          value={nextRange.from}
                          onChange={(e) => setNextRange(prev => ({...prev, from: parseInt(e.target.value, 10) || 1}))}
                          disabled={!isMoreRangesPossible}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-700 bg-white dark:bg-slate-800"
                      />
                  </div>
                   <div className="flex-1">
                      <label htmlFor="to-page" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">إلى صفحة</label>
                      <input
                          type="number"
                          id="to-page"
                          min="1"
                          max={totalPages}
                          value={nextRange.to}
                          onChange={(e) => setNextRange(prev => ({...prev, to: parseInt(e.target.value, 10) || totalPages}))}
                          disabled={!isMoreRangesPossible}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-700 bg-white dark:bg-slate-800"
                      />
                  </div>
                  <button
                    onClick={handleAddRange}
                    disabled={!isMoreRangesPossible}
                    className="self-end bg-green-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600 transition-colors disabled:bg-slate-400"
                  >
                    إضافة نطاق
                  </button>
              </div>
               {!isMoreRangesPossible && ranges.length > 0 && (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-2 text-center">تم تحديد جميع الصفحات!</p>
               )}
            </div>

            <div className="mt-8 text-center">
                <button
                id="primary-action-button"
                title="Cmd/Ctrl + Enter"
                onClick={handleSplit}
                disabled={isLoading || ranges.length === 0}
                className="bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center w-full sm:w-64 mx-auto"
                >
                {isLoading ? <Spinner /> : `تقسيم ${ranges.length} نطاق`}
                </button>
            </div>
          </div>
        )}
        
        {isLoading && <p className="mt-4 text-slate-600 dark:text-slate-300" role="status">{progress}</p>}
        {error && <p role="alert" className="mt-4 text-red-500 bg-red-100 dark:bg-red-900/50 dark:text-red-300 p-3 rounded-md w-full text-center">{error}</p>}
      </div>
    </div>
  );
};

export default SplitPdf;