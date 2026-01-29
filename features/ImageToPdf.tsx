import React, { useState } from 'react';
import Spinner from '../components/Spinner';
import FileUpload from '../components/FileUpload';
import { processPdf } from '../services/pdfProcessor';
import ResultView from '../components/ResultView';
import { Service } from '../types';
import { PDF_SERVICES } from '../constants';
import { useAppContext } from '../AppContext';

interface ImageToPdfProps {
  onSelectService: (service: Service) => void;
}

const ImageToPdf: React.FC<ImageToPdfProps> = ({ onSelectService }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [resultFile, setResultFile] = useState<File | null>(null);
  
  const { setStagedFile } = useAppContext();

  const handleFileSelect = (selectedFiles: File[]) => {
    const imageFiles = selectedFiles.filter((f: File) => f.type === 'image/jpeg' || f.type === 'image/png');
     if (imageFiles.length !== selectedFiles.length) {
        setError('تم اختيار بعض الملفات غير المدعومة (يدعم فقط JPG, PNG). سيتم تجاهلها.');
    } else {
        setError('');
    }
    setFiles(prev => [...prev, ...imageFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }

  const handleConvert = async () => {
    if (files.length === 0) {
      setError('الرجاء اختيار صورة واحدة على الأقل.');
      return;
    }
    setIsLoading(true);
    setError('');
    setProgress('جاري بدء عملية التحويل...');
    try {
      const resultBlob = await processPdf({ operation: 'images-to-pdf', files }, setProgress);
      const newFile = new File([resultBlob], 'converted-images.pdf', { type: 'application/pdf' });
      setResultFile(newFile);
    } catch (err: unknown) {
      setError('حدث خطأ أثناء تحويل الصور. يرجى التأكد من أن الملفات غير تالفة.');
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
    const nextSteps = PDF_SERVICES.filter(s => ['compress', 'protect', 'merge', 'split', 'edit', 'sign-pdf'].includes(s.id));
    return (
        <ResultView
            title="اكتمل التحويل إلى PDF بنجاح!"
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
            acceptedFileTypes="image/jpeg,image/png"
            multiple={true}
            promptText="اسحب وأفلت صوراً هنا أو انقر للاختيار"
            promptSubText="يدعم صيغ JPG, PNG"
        />

        {files.length > 0 && (
            <div className="mt-6 w-full">
                <h3 className="font-bold text-lg mb-2 dark:text-slate-200">الصور المختارة:</h3>
                <ul className="space-y-2 max-h-60 overflow-y-auto p-2 border dark:border-slate-600 rounded-md">
                    {files.map((file, index) => (
                        <li key={index} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-700 rounded">
                            <span className="truncate text-slate-700 dark:text-slate-300">{file.name}</span>
                            <button onClick={() => removeFile(index)} className="text-red-500 hover:text-red-700 p-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        )}

        <button
          id="primary-action-button"
          title="Cmd/Ctrl + Enter"
          onClick={handleConvert}
          disabled={isLoading || files.length === 0}
          className="mt-6 bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center w-48"
        >
          {isLoading ? <Spinner /> : 'تحويل الآن'}
        </button>
        
        {isLoading && <p className="mt-4 text-slate-600 dark:text-slate-300" role="status">{progress}</p>}
        {error && <p role="alert" className="mt-4 text-red-500 bg-red-100 dark:bg-red-900/50 dark:text-red-300 p-3 rounded-md w-full text-center">{error}</p>}
      </div>
    </div>
  );
};

export default ImageToPdf;