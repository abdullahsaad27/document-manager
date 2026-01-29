import React, { useState, useEffect } from 'react';
import Spinner from '../components/Spinner';
import FileUpload from '../components/FileUpload';
import { processPdf } from '../services/pdfProcessor';
import ResultView from '../components/ResultView';
import { useAppContext } from '../AppContext';
import { Service } from '../types';
import { PDF_SERVICES } from '../constants';

declare const PDFLib: any;
declare const fontkit: any;
declare const mammoth: any;

interface WordToPdfProps {
  onSelectService: (service: Service) => void;
}

const WordToPdf: React.FC<WordToPdfProps> = ({ onSelectService }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [resultFile, setResultFile] = useState<File | null>(null);
  
  const { setStagedFile } = useAppContext();

  const handleFileSelect = (files: File[]) => {
    if (files.length > 0) {
      const selectedFile = files[0];
      const acceptedTypes = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (acceptedTypes.includes(selectedFile.type)) {
        setFile(selectedFile);
        setResultFile(null);
        setError('');
      } else {
        setError('الرجاء اختيار ملف DOCX فقط.');
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
    setProgress('جاري استخراج النص من ملف Word...');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const { value } = await mammoth.extractRawText({ arrayBuffer });
      
      if (!value) {
        throw new Error('لم يتمكن من استخراج أي نص من الملف.');
      }

      setProgress('جاري إنشاء ملف PDF...');
      
      const { PDFDocument, rgb } = PDFLib;
      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);

      const fontUrl = 'https://fonts.gstatic.com/s/cairo/v28/SLXgc1nY6HkvangtZmpQdkh-SCpsapi-.ttf';
      const fontBytes = await fetch(fontUrl).then(res => res.arrayBuffer());
      const customFont = await pdfDoc.embedFont(fontBytes);

      let page = pdfDoc.addPage();
      const { width, height } = page.getSize();
      const fontSize = 12;
      const margin = 50;
      let y = height - margin;
      
      const lines = value.split('\n');

      for (const line of lines) {
        const textWidth = customFont.widthOfTextAtSize(line, fontSize);
        if (y < margin) {
            page = pdfDoc.addPage();
            y = height - margin;
        }
        page.drawText(line, {
            x: width - margin - textWidth, // Align right for Arabic
            y,
            font: customFont,
            size: fontSize,
            color: rgb(0, 0, 0),
        });
        y -= fontSize + 5; // Line height
      }

      const pdfBytes = await pdfDoc.save();
      const newFile = new File([pdfBytes], `${file.name.split('.')[0]}.pdf`, { type: 'application/pdf' });
      setResultFile(newFile);

    } catch (err: unknown) {
      setError('حدث خطأ أثناء تحويل الملف.');
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
            acceptedFileTypes=".docx"
            promptText={file ? file.name : 'اسحب وأفلت ملف DOCX هنا أو انقر للاختيار'}
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

export default WordToPdf;