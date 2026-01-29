import React, { useState, useEffect, useRef } from 'react';
import Spinner from '../components/Spinner';
import FileUpload from '../components/FileUpload';
import SignaturePad from '../components/SignaturePad';
import ResultView from '../components/ResultView';
import { useAppContext } from '../AppContext';
import { Service } from '../types';
import { SERVICES } from '../constants';

declare const PDFLib: any;
declare const html2canvas: any;

type SignatureMode = 'draw' | 'type';

interface SignPdfProps {
  onSelectService: (service: Service) => void;
}

const SignPdf: React.FC<SignPdfProps> = ({ onSelectService }) => {
  const [file, setFile] = useState<File | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [resultFile, setResultFile] = useState<File | null>(null);
  
  const [mode, setMode] = useState<SignatureMode>('draw');
  const [typedSignature, setTypedSignature] = useState('');
  const signaturePreviewRef = useRef<HTMLDivElement>(null);

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

  const handleUseTypedSignature = async () => {
    if (signaturePreviewRef.current && typedSignature.trim()) {
      try {
        setProgress('جاري إنشاء صورة التوقيع...');
        setIsLoading(true);
        const canvas = await html2canvas(signaturePreviewRef.current, { backgroundColor: null });
        const dataUrl = canvas.toDataURL('image/png');
        setSignatureDataUrl(dataUrl);
      } catch(e) {
        setError('فشل في إنشاء صورة التوقيع.');
      } finally {
        setIsLoading(false);
        setProgress('');
      }
    }
  }

  const handleSign = async () => {
    if (!file) {
      setError('الرجاء اختيار ملف PDF أولاً.');
      return;
    }
    if (!signatureDataUrl) {
      setError('الرجاء إنشاء توقيعك أولاً.');
      return;
    }
    setIsLoading(true);
    setError('');
    setProgress('جاري إضافة التوقيع...');

    try {
      const { PDFDocument } = PDFLib;
      const existingPdfBytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(existingPdfBytes, { ignoreEncryption: true });
      
      const pngImageBytes = await fetch(signatureDataUrl).then(res => res.arrayBuffer());
      const pngImage = await pdfDoc.embedPng(pngImageBytes);
      
      const firstPage = pdfDoc.getPages()[0];
      const { width, height } = firstPage.getSize();
      
      const sigWidth = 150;
      const sigHeight = (pngImage.height / pngImage.width) * sigWidth;
      
      firstPage.drawImage(pngImage, {
        x: width - sigWidth - 50,
        y: 50,
        width: sigWidth,
        height: sigHeight,
      });

      const pdfBytes = await pdfDoc.save();
      const newFile = new File([pdfBytes], `signed-${file.name}`, { type: 'application/pdf' });
      setResultFile(newFile);

    } catch (err: unknown) {
      setError('حدث خطأ أثناء توقيع الملف.');
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
    setSignatureDataUrl(null);
    setTypedSignature('');
    setMode('draw');
  };

  const handleNextStep = (service: Service, file: File) => {
    setStagedFile(file);
    onSelectService(service);
  };
  
  if (resultFile) {
    const nextSteps = SERVICES.filter(s => ['compress', 'protect'].includes(s.id));
    return (
        <ResultView
            title="اكتمل التوقيع بنجاح!"
            file={resultFile}
            onReset={handleReset}
            nextSteps={nextSteps}
            onNextStep={handleNextStep}
        />
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg">
      <div className="grid md:grid-cols-2 gap-8 items-start">
        <div className="flex flex-col items-center gap-4">
          <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">الخطوة 1: رفع المستند</h3>
          <FileUpload
              onFileSelect={handleFileSelect}
              acceptedFileTypes=".pdf"
              promptText={file ? file.name : 'اسحب وأفلت ملف PDF هنا'}
          />
        </div>
        <div className="flex flex-col items-center gap-4">
          <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">الخطوة 2: إنشاء التوقيع</h3>
           <div role="tablist" className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-lg w-full">
                <button role="tab" aria-selected={mode === 'draw'} onClick={() => { setMode('draw'); setSignatureDataUrl(null); }} className={`flex-1 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${mode === 'draw' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                    رسم
                </button>
                 <button role="tab" aria-selected={mode === 'type'} onClick={() => { setMode('type'); setSignatureDataUrl(null); }} className={`flex-1 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${mode === 'type' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                    كتابة
                </button>
            </div>
            
            {mode === 'draw' && (
                <div role="tabpanel" className="w-full">
                    <SignaturePad onSave={setSignatureDataUrl} />
                </div>
            )}
            
            {mode === 'type' && (
                <div role="tabpanel" className="w-full flex flex-col items-center gap-3">
                    <label htmlFor="type-signature-input" className="sr-only">اكتب اسمك للتوقيع</label>
                    <input 
                        id="type-signature-input"
                        type="text"
                        value={typedSignature}
                        onChange={(e) => { setTypedSignature(e.target.value); setSignatureDataUrl(null); }}
                        placeholder="اكتب اسمك هنا..."
                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800"
                    />
                    <div className="w-full p-4 bg-white border border-slate-300 dark:border-slate-600 rounded-md min-h-[100px] flex items-center justify-center" aria-live="polite">
                        <div ref={signaturePreviewRef} style={{ fontFamily: "'Brush Script MT', 'Brush Script Std', cursive", fontSize: '3rem' }} className="text-slate-800 dark:text-slate-800">
                             {typedSignature || '...'}
                        </div>
                    </div>
                     <button onClick={handleUseTypedSignature} disabled={!typedSignature.trim()} className="text-sm font-semibold text-blue-600 hover:text-blue-800 disabled:text-slate-400 disabled:cursor-not-allowed">
                        اعتماد هذا التوقيع
                    </button>
                </div>
            )}

        </div>
      </div>
      
      <div className="mt-8 border-t dark:border-slate-700 pt-6 flex flex-col items-center">
        {signatureDataUrl && (
            <div className="mb-4 p-2 border-2 border-dashed border-green-400 rounded-lg bg-green-50 dark:bg-green-900/30">
                <p className="text-sm font-semibold text-green-700 dark:text-green-300">تم حفظ التوقيع وجاهز للاستخدام!</p>
            </div>
        )}
        <button
          id="primary-action-button"
          title="Cmd/Ctrl + Enter"
          onClick={handleSign}
          disabled={isLoading || !file || !signatureDataUrl}
          className="bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center w-64"
        >
          {isLoading ? <Spinner /> : 'توقيع وحفظ المستند'}
        </button>
        {isLoading && <p className="mt-4 text-slate-600 dark:text-slate-300" role="status">{progress}</p>}
        {error && <p role="alert" className="mt-4 text-red-500 bg-red-100 dark:bg-red-900/50 dark:text-red-300 p-3 rounded-md w-full text-center">{error}</p>}
      </div>
    </div>
  );
};

export default SignPdf;