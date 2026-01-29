import React, { useState, useEffect } from 'react';
import Spinner from '../components/Spinner';
import FileUpload from '../components/FileUpload';
import { processPdf } from '../services/pdfProcessor';
import ResultView from '../components/ResultView';
import { useAppContext } from '../AppContext';
import { Service } from '../types';
import { PDF_SERVICES } from '../constants';

type ProtectMode = 'encrypt' | 'decrypt';

interface ProtectPdfProps {
  onSelectService: (service: Service) => void;
}

const ProtectPdf: React.FC<ProtectPdfProps> = ({ onSelectService }) => {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [resultFile, setResultFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ProtectMode>('encrypt');
  
  const { stagedFile, setStagedFile } = useAppContext();

  useEffect(() => {
    if (stagedFile) {
      setFile(stagedFile);
      setStagedFile(null);
    }
  }, [stagedFile, setStagedFile]);

  const handleFileSelect = (files: File[]) => {
    if (files.length > 0) {
      if (files[0].type === 'application/pdf') {
        setFile(files[0]);
        setError('');
        setPassword('');
        setResultFile(null);
      } else {
        setError('الرجاء اختيار ملف PDF.');
      }
    }
  };

  const handleProtect = async () => {
    if (!file) {
      setError('الرجاء اختيار ملف أولاً.');
      return;
    }
    if (!password) {
      setError('الرجاء إدخال كلمة مرور.');
      return;
    }

    setIsLoading(true);
    setError('');
    setProgress(`جاري ${mode === 'encrypt' ? 'التشفير' : 'فك التشفير'}...`);

    try {
      const resultBlob = await processPdf({ operation: mode, file, password }, setProgress);
      const outputFileName = `${mode}-${file.name}`;
      const newFile = new File([resultBlob], outputFileName, { type: 'application/pdf' });
      setResultFile(newFile);
    } catch (err: unknown) {
      setError(mode === 'encrypt' ? 'فشل تشفير الملف. قد يكون الملف تالفًا.' : 'فشل فك تشفير الملف. يرجى التأكد من صحة كلمة المرور.');
      console.error(err);
    } finally {
      setIsLoading(false);
      setProgress('');
    }
  };

  const handleReset = () => {
    setFile(null);
    setResultFile(null);
    setError('');
    setPassword('');
  };
  
  const handleNextStep = (service: Service, file: File) => {
    setStagedFile(file);
    onSelectService(service);
  };

  if (resultFile) {
    const nextSteps = mode === 'encrypt' 
      ? [] 
      : PDF_SERVICES.filter(s => ['compress', 'merge', 'split', 'edit', 'sign-pdf'].includes(s.id));
      
    return (
        <ResultView
            title={`اكتمل ${mode === 'encrypt' ? 'التشفير' : 'فك التشفير'} بنجاح!`}
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
        <div role="tablist" className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-lg mb-6">
          <button role="tab" aria-selected={mode === 'encrypt'} onClick={() => setMode('encrypt')} className={`px-6 py-1.5 rounded-md text-sm font-semibold transition-colors ${mode === 'encrypt' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
            تشفير
          </button>
          <button role="tab" aria-selected={mode === 'decrypt'} onClick={() => setMode('decrypt')} className={`px-6 py-1.5 rounded-md text-sm font-semibold transition-colors ${mode === 'decrypt' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
            فك التشفير
          </button>
        </div>
        
        <FileUpload 
            onFileSelect={handleFileSelect}
            acceptedFileTypes=".pdf"
            promptText={file ? file.name : "اسحب وأفلت ملف PDF هنا أو انقر للاختيار"}
        />
        
        <div className="mt-6 w-full">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">كلمة المرور</label>
            <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'encrypt' ? 'أدخل كلمة مرور قوية' : 'أدخل كلمة مرور الملف'}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800"
            />
        </div>

        <button
          id="primary-action-button"
          title="Cmd/Ctrl + Enter"
          onClick={handleProtect}
          disabled={isLoading || !file || !password}
          className="mt-6 bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center w-48"
        >
          {isLoading ? <Spinner /> : (mode === 'encrypt' ? 'تشفير الآن' : 'فك التشفير')}
        </button>
        
        {isLoading && <p className="mt-4 text-slate-600 dark:text-slate-300" role="status">{progress}</p>}
        {error && <p role="alert" className="mt-4 text-red-500 bg-red-100 dark:bg-red-900/50 dark:text-red-300 p-3 rounded-md w-full text-center">{error}</p>}
      </div>
    </div>
  );
};

export default ProtectPdf;