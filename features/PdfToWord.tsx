import React, { useState, useEffect } from 'react';
import Spinner from '../components/Spinner';
import FileUpload from '../components/FileUpload';
import ResultView from '../components/ResultView';
import { useAppContext } from '../AppContext';
import { Service } from '../types';
import { SERVICES } from '../constants';

declare const pdfjsLib: any;

interface PdfToWordProps {
  onSelectService: (service: Service) => void;
}

const PdfToWord: React.FC<PdfToWordProps> = ({ onSelectService }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [resultFile, setResultFile] = useState<File | null>(null);
  
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
        setResultFile(null);
        setError('');
      } else {
        setError('الرجاء اختيار ملف PDF فقط.');
      }
    }
  };

  const handleConvert = async () => {
    if (!file) {
      setError('الرجاء اختيار ملف أولاً.');
      return;
    }
    setIsLoading(true);
    setError('');
    setProgress('جاري قراءة ملف PDF...');

    try {
      const docx = (window as any).docx;
      if (!docx || !docx.Document || !docx.Paragraph || !docx.Packer) {
        throw new Error("مكتبة تصدير Word غير متاحة أو لم يتم تحميلها بالكامل. يرجى التحقق من اتصالك بالإنترنت وتحديث الصفحة.");
      }
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      const numPages = pdf.numPages;
      const paragraphs: any[] = [];

      for (let i = 1; i <= numPages; i++) {
        setProgress(`جاري معالجة الصفحة ${i} من ${numPages}...`);
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        
        // A simple approach to group text items into lines/paragraphs
        const lines = content.items.map((item: any) => item.str).join(' ');
        paragraphs.push(new docx.Paragraph({
            text: lines,
            bidirectional: true
        }));
      }

      setProgress('جاري إنشاء مستند Word...');
      const doc = new docx.Document({
        sections: [{ children: paragraphs }],
      });

      const blob = await docx.Packer.toBlob(doc);
      const newFile = new File([blob], `${file.name.split('.')[0]}.docx`, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      setResultFile(newFile);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء تحويل الملف. قد يكون الملف محميًا أو لا يحتوي على نص.';
      setError(message);
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
  };

  if (resultFile) {
    return (
        <ResultView
            title="اكتمل التحويل إلى Word بنجاح!"
            file={resultFile}
            onReset={handleReset}
        />
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

        <div className="mt-4 text-sm text-slate-600 dark:text-slate-300 bg-amber-100 dark:bg-amber-900/50 border-r-4 border-amber-400 p-3 rounded-md">
            <strong>ملاحظة:</strong> سيتم تحويل المحتوى النصي فقط. قد يتم فقدان التنسيقات المعقدة والصور والجداول.
        </div>
        
        <button
          id="primary-action-button"
          title="Cmd/Ctrl + Enter"
          onClick={handleConvert}
          disabled={isLoading || !file}
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

export default PdfToWord;