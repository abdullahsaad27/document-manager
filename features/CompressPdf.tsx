import React, { useState, useEffect } from 'react';
import Spinner from '../components/Spinner';
import FileUpload from '../components/FileUpload';
import { processPdf } from '../services/pdfProcessor';
import ResultView from '../components/ResultView';
import { useAppContext } from '../AppContext';
import { Service } from '../types';
import { PDF_SERVICES } from '../constants';

type CompressionLevel = 'high' | 'medium' | 'low';

interface CompressPdfProps {
  onSelectService: (service: Service) => void;
}

const CompressPdf: React.FC<CompressPdfProps> = ({ onSelectService }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [resultFile, setResultFile] = useState<File | null>(null);
  const [originalSize, setOriginalSize] = useState(0);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>('medium');

  const { stagedFile, setStagedFile } = useAppContext();

  useEffect(() => {
    if (stagedFile) {
      handleFileSelect([stagedFile]);
      setStagedFile(null);
    }
  }, [stagedFile, setStagedFile]);

  const handleFileSelect = (files: File[]) => {
    if (files.length > 0) {
      const selectedFile = files[0];
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
        setOriginalSize(selectedFile.size);
        setResultFile(null);
        setError('');
      } else {
        setError('الرجاء اختيار ملف PDF فقط.');
      }
    }
  };

  const handleCompress = async () => {
    if (!file) {
      setError('الرجاء اختيار ملف أولاً.');
      return;
    }
    setIsLoading(true);
    setError('');
    setProgress('جاري بدء عملية الضغط...');
    try {
      const resultBlob = await processPdf({ operation: 'compress', file, quality: compressionLevel }, setProgress);
      const newFile = new File([resultBlob], `compressed-${file.name}`, { type: 'application/pdf' });
      setResultFile(newFile);
    } catch (err: unknown) {
      setError('حدث خطأ أثناء ضغط الملف. قد يكون الملف تالفًا أو محميًا.');
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
    setOriginalSize(0);
  };
  
  const handleNextStep = (service: Service, file: File) => {
    setStagedFile(file);
    onSelectService(service);
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  if (resultFile) {
    const nextSteps = PDF_SERVICES.filter(s => ['protect', 'split', 'edit', 'sign-pdf'].includes(s.id));
    const reduction = Math.round(100 - (resultFile.size / originalSize) * 100);
    return (
        <ResultView
            title="اكتمل الضغط بنجاح!"
            file={resultFile}
            onReset={handleReset}
            nextSteps={nextSteps}
            onNextStep={handleNextStep}
        >
          <div className="text-center bg-slate-100 dark:bg-slate-700 p-4 rounded-lg">
                <p className="text-slate-700 dark:text-slate-300 mt-2">
                    الحجم الأصلي: <span className="font-semibold">{formatBytes(originalSize)}</span>
                </p>
                <p className="text-slate-700 dark:text-slate-300">
                    الحجم الجديد: <span className="font-semibold">{formatBytes(resultFile.size)}</span>
                </p>
                <p className={`${reduction > 0 ? 'text-green-700 dark:text-green-300' : 'text-slate-600 dark:text-slate-400'} font-bold mt-1`}>
                    {reduction > 0 ? `تم تقليل الحجم بنسبة ${reduction}%` : 'لم يتم تقليل الحجم بشكل ملحوظ.'}
                </p>
            </div>
        </ResultView>
    );
  }

  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg">
      <div className="flex flex-col items-center">
        <FileUpload
            onFileSelect={handleFileSelect}
            acceptedFileTypes=".pdf"
            promptText={file ? file.name : 'اسحب وأفلت ملف PDF هنا أو انقر للاختيار'}
        />

        <div className="mt-6 w-full">
          <fieldset>
            <legend className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-3 text-center">اختر مستوى الضغط</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
              <div>
                <input type="radio" id="level-high" name="compressionLevel" value="high" checked={compressionLevel === 'high'} onChange={(e) => setCompressionLevel(e.target.value as CompressionLevel)} className="sr-only" />
                <label htmlFor="level-high" className="block p-3 border-2 rounded-lg cursor-pointer transition-colors border-slate-300 dark:border-slate-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700 has-[:checked]:bg-blue-100 dark:has-[:checked]:bg-blue-900/50 has-[:checked]:border-blue-600">
                  <span className="font-semibold">ضغط أساسي</span>
                  <span className="text-xs block text-slate-500 dark:text-slate-400">أكبر حجم، أعلى توافقية</span>
                </label>
              </div>
              <div>
                <input type="radio" id="level-medium" name="compressionLevel" value="medium" checked={compressionLevel === 'medium'} onChange={(e) => setCompressionLevel(e.target.value as CompressionLevel)} className="sr-only" />
                <label htmlFor="level-medium" className="block p-3 border-2 rounded-lg cursor-pointer transition-colors border-slate-300 dark:border-slate-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700 has-[:checked]:bg-blue-100 dark:has-[:checked]:bg-blue-900/50 has-[:checked]:border-blue-600">
                   <span className="font-semibold">موصى به</span>
                   <span className="text-xs block text-slate-500 dark:text-slate-400">توازن جيد بين الحجم والجودة</span>
                </label>
              </div>
              <div>
                <input type="radio" id="level-low" name="compressionLevel" value="low" checked={compressionLevel === 'low'} onChange={(e) => setCompressionLevel(e.target.value as CompressionLevel)} className="sr-only" />
                <label htmlFor="level-low" className="block p-3 border-2 rounded-lg cursor-pointer transition-colors border-slate-300 dark:border-slate-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700 has-[:checked]:bg-blue-100 dark:has-[:checked]:bg-blue-900/50 has-[:checked]:border-blue-600">
                   <span className="font-semibold">ضغط أقصى</span>
                   <span className="text-xs block text-slate-500 dark:text-slate-400">أصغر حجم ممكن</span>
                </label>
              </div>
            </div>
          </fieldset>
        </div>
        
        <button
          id="primary-action-button"
          title="Cmd/Ctrl + Enter"
          onClick={handleCompress}
          disabled={isLoading || !file}
          className="mt-6 bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center w-48"
        >
          {isLoading ? <Spinner /> : 'ضغط الآن'}
        </button>
        
        {isLoading && <p className="mt-4 text-slate-600 dark:text-slate-300" role="status">{progress}</p>}
        {error && <p role="alert" className="mt-4 text-red-500 bg-red-100 dark:bg-red-900/50 dark:text-red-300 p-3 rounded-md w-full text-center">{error}</p>}
        
      </div>
    </div>
  );
};

export default CompressPdf;