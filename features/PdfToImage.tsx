import React, { useState, useRef, useEffect } from 'react';
import Spinner from '../components/Spinner';
import FileUpload from '../components/FileUpload';
import { useAppContext } from '../AppContext';
import { Service } from '../types';
import ResultView from '../components/ResultView';

declare const PDFLib: any;
declare const pdfjsLib: any;
declare const JSZip: any;

interface PdfToImageProps {
  onSelectService: (service: Service) => void;
}

const PdfToImage: React.FC<PdfToImageProps> = ({ onSelectService }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [resultFile, setResultFile] = useState<File | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
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
        setError('');
        setResultFile(null);
      } else {
        setError('الرجاء اختيار ملف PDF فقط.');
      }
    }
  };

  const handleConvert = async () => {
    if (!file || !canvasRef.current) {
      setError('الرجاء اختيار ملف أولاً.');
      return;
    }

    setIsLoading(true);
    setError('');
    setProgress('جاري بدء التحويل...');
    setResultFile(null);

    try {
      const { PDFDocument } = PDFLib;
      const arrayBuffer = await file.arrayBuffer();

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
      const urls: string[] = [];
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('لا يمكن الحصول على سياق Canvas');
      }

      for (let i = 1; i <= numPages; i++) {
        setProgress(`جاري تحويل الصفحة ${i} من ${numPages}...`);
        const page = await pdf.getPage(i);
        // Increased scale for higher quality images
        const viewport = page.getViewport({ scale: 2.5 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport: viewport }).promise;
        urls.push(canvas.toDataURL('image/png'));
      }

      if (urls.length === 0) {
        throw new Error('لم يتم العثور على صفحات لتحويلها.');
      }

      setProgress('جاري ضغط الصور في ملف مضغوط...');
      const zip = new JSZip();
      for (let i = 0; i < urls.length; i++) {
        // Fetch the data URL and convert to blob
        const response = await fetch(urls[i]);
        const blob = await response.blob();
        zip.file(`page-${i + 1}.png`, blob);
      }
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const newFile = new File([zipBlob], `images-${file.name.replace(/\.pdf$/i, '')}.zip`, { type: 'application/zip' });
      setResultFile(newFile);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'حدث خطأ غير متوقع.';
      setError(`فشل تحويل الملف: ${message}`);
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
    setProgress('');
  };

  if (resultFile) {
    return (
        <ResultView
            title={`تم تحويل ${file?.name} إلى صور بنجاح!`}
            file={resultFile}
            onReset={handleReset}
        >
            <div className="text-center bg-slate-100 dark:bg-slate-700 p-4 rounded-lg">
                <p className="text-slate-700 dark:text-slate-300">
                    تم ضغط جميع الصور عالية الجودة في ملف واحد جاهز للتنزيل.
                </p>
            </div>
        </ResultView>
    );
  }

  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg">
        <canvas ref={canvasRef} className="hidden"></canvas>
      <div className="flex flex-col items-center">
        <FileUpload 
            onFileSelect={handleFileSelect}
            acceptedFileTypes=".pdf"
            promptText={file ? file.name : 'اسحب وأفلت ملف PDF هنا أو انقر للاختيار'}
        />
        <div className="mt-4 text-sm text-slate-600 dark:text-slate-300 bg-amber-100 dark:bg-amber-900/50 border-r-4 border-amber-400 p-3 rounded-md">
            <strong>ملاحظة:</strong> سيتم تحويل كل صفحة إلى صورة عالية الجودة وجمعها في ملف مضغوط (ZIP).
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

export default PdfToImage;