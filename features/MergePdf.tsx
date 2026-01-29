import React, { useState, useEffect } from 'react';
import Spinner from '../components/Spinner';
import FileUpload from '../components/FileUpload';
import { processPdf } from '../services/pdfProcessor';
import ResultView from '../components/ResultView';
import { useAppContext } from '../AppContext';
import { Service } from '../types';
import { PDF_SERVICES } from '../constants';

interface MergePdfProps {
  onSelectService: (service: Service) => void;
}

const MergePdf: React.FC<MergePdfProps> = ({ onSelectService }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [resultFile, setResultFile] = useState<File | null>(null);

  const { stagedFile, setStagedFile } = useAppContext();

  useEffect(() => {
    if (stagedFile) {
      setFiles([stagedFile]);
      setStagedFile(null);
    }
  }, [stagedFile, setStagedFile]);


  const handleFileSelect = (selectedFiles: File[]) => {
    const newPdfFiles = selectedFiles.filter((f: File) => f.type === 'application/pdf');
    if (newPdfFiles.length !== selectedFiles.length) {
        setError('تم اختيار بعض الملفات غير المدعومة. سيتم تجاهلها.');
    } else {
        setError('');
    }
    setFiles(prev => [...prev, ...newPdfFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }
  
  const moveFile = (index: number, direction: 'up' | 'down') => {
    setFiles(prev => {
        const newFiles = [...prev];
        const item = newFiles.splice(index, 1)[0];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        newFiles.splice(newIndex, 0, item);
        return newFiles;
    });
  };


  const handleMerge = async () => {
    if (files.length < 2) {
      setError('الرجاء اختيار ملفين على الأقل للدمج.');
      return;
    }
    setIsLoading(true);
    setError('');
    setProgress('جاري بدء عملية الدمج...');
    try {
      const resultBlob = await processPdf({ operation: 'merge', files }, setProgress);
      const newFile = new File([resultBlob], 'merged-document.pdf', { type: 'application/pdf' });
      setResultFile(newFile);
    } catch (err: unknown) {
      setError('حدث خطأ أثناء دمج الملفات. يرجى التأكد من أن الملفات غير تالفة أو محمية.');
      console.error(err);
    } finally {
      setIsLoading(false);
      setProgress('');
    }
  };
  
  const handleReset = () => {
    setFiles([]);
    setResultFile(null);
    setError('');
  };

  const handleNextStep = (service: Service, file: File) => {
    setStagedFile(file);
    onSelectService(service);
  };
  
  if (resultFile) {
    const nextSteps = PDF_SERVICES.filter(s => ['compress', 'protect', 'split', 'edit', 'sign-pdf'].includes(s.id));
    return (
        <ResultView
            title="اكتمل الدمج بنجاح!"
            file={resultFile}
            onReset={handleReset}
            nextSteps={nextSteps}
            onNextStep={handleNextStep}
        />
    );
  }

  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg">
      <div className="flex flex-col items-center">
        <FileUpload 
            onFileSelect={handleFileSelect}
            acceptedFileTypes=".pdf"
            multiple={true}
            promptText="اسحب وأفلت ملفات PDF هنا أو انقر للاختيار"
            promptSubText="يمكنك تحديد ملفات متعددة"
        />

        {files.length > 0 && (
            <div className="mt-6 w-full">
                <h3 className="font-bold text-lg mb-2 dark:text-slate-200">الملفات المختارة (مرتبة للدمج):</h3>
                <ul className="space-y-2 max-h-60 overflow-y-auto p-2 border dark:border-slate-600 rounded-md">
                    {files.map((file, index) => (
                        <li key={`${file.name}-${index}`} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-700 rounded">
                            <span className="truncate text-slate-700 dark:text-slate-300 flex-grow" id={`file-name-${index}`}>{index + 1}. {file.name}</span>
                            <div className="flex items-center gap-1 flex-shrink-0" role="group" aria-labelledby={`file-name-${index}`}>
                                <button onClick={() => moveFile(index, 'up')} disabled={index === 0} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 p-1 disabled:opacity-30 disabled:cursor-not-allowed" aria-label={`تحريك ${file.name} لأعلى`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                                </button>
                                <button onClick={() => moveFile(index, 'down')} disabled={index === files.length - 1} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 p-1 disabled:opacity-30 disabled:cursor-not-allowed" aria-label={`تحريك ${file.name} لأسفل`}>
                                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                </button>
                                <button onClick={() => removeFile(index)} className="text-red-500 hover:text-red-700 p-1" aria-label={`إزالة ${file.name}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        )}

        <button
          id="primary-action-button"
          title="Cmd/Ctrl + Enter"
          onClick={handleMerge}
          disabled={isLoading || files.length < 2}
          className="mt-6 bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center w-48"
        >
          {isLoading ? <Spinner /> : 'دمج الآن'}
        </button>
        
        {isLoading && <p className="mt-4 text-slate-600 dark:text-slate-300" role="status">{progress}</p>}
        {error && <p role="alert" className="mt-4 text-red-500 bg-red-100 dark:bg-red-900/50 dark:text-red-300 p-3 rounded-md w-full text-center">{error}</p>}
      </div>
    </div>
  );
};

export default MergePdf;