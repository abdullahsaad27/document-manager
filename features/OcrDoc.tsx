import React, { useState } from 'react';
import { ocrImage } from '../services/aiService';
import Spinner from '../components/Spinner';
import FileUpload from '../components/FileUpload';
import ResultView from '../components/ResultView';
import { Service, StructuredContentItem } from '../types';

interface OcrDocProps {
  onSelectService: (service: Service) => void;
}

const OcrDoc: React.FC<OcrDocProps> = ({ onSelectService }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [error, setError] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const handleFileSelect = (files: File[]) => {
    if (files.length > 0) {
      const selectedFile = files[0];
      if (!selectedFile.type.startsWith('image/')) {
        setError('الرجاء اختيار ملف صورة (PNG, JPG, WEBP).');
        return;
      }
      setFile(selectedFile);
      setExtractedText('');
      setError('');
      setImageUrl(URL.createObjectURL(selectedFile));
    }
  };

  const fileToGenerativePart = async (fileToConvert: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(fileToConvert);
    });
    return {
      inlineData: { data: await base64EncodedDataPromise, mimeType: fileToConvert.type },
    };
  };

  const handleSubmit = async () => {
    if (!file) {
      setError('الرجاء اختيار ملف صورة أولاً.');
      return;
    }

    setIsLoading(true);
    setError('');
    setExtractedText('');

    try {
      const imagePart = await fileToGenerativePart(file);
      const result = await ocrImage(imagePart);
      setExtractedText(result);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ غير متوقع أثناء استخراج النص.');
      setFile(null);
      setImageUrl('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setExtractedText('');
    setError('');
    setImageUrl('');
  };
  
  const handleCopyText = () => {
      navigator.clipboard.writeText(extractedText).then(() => {
          alert("تم نسخ النص!");
      }).catch(err => {
          console.error("فشل النسخ: ", err);
      });
  };

  if (extractedText && file) {
    const structuredContent: StructuredContentItem[] = [{ type: 'paragraph', content: extractedText }];
    return (
      <ResultView
        title={`النص المستخرج من: ${file.name}`}
        onReset={handleReset}
        canSaveToLibrary={true}
        structuredContent={structuredContent}
        fileName={file.name}
        fileType={file.type}
      >
        <div className="relative">
          <textarea
            readOnly
            value={extractedText}
            className="w-full h-96 p-4 border rounded-lg bg-slate-50 text-right font-sans dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
            placeholder="النص المستخرج..."
            style={{ direction: 'rtl' }}
            aria-label="النص المستخرج"
          />
          <button 
              onClick={handleCopyText}
              className="absolute top-2 left-2 p-2 bg-slate-200 dark:bg-slate-600 rounded-md hover:bg-slate-300 dark:hover:bg-slate-500"
              aria-label="نسخ النص"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
        </div>
      </ResultView>
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg">
      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-1/2 flex flex-col items-center">
            {isLoading ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-10">
                    <Spinner />
                    <p className="mt-2 text-slate-600 dark:text-slate-300">جاري الاستخراج...</p>
                </div>
            ) : !imageUrl ? (
                <FileUpload
                    onFileSelect={handleFileSelect}
                    acceptedFileTypes="image/png,image/jpeg,image/webp"
                    promptText="اسحب صورة هنا أو انقر للاختيار"
                    promptSubText="يدعم: PNG, JPG, WEBP"
                />
            ) : (
                 <div className="w-full h-full flex-grow cursor-pointer bg-slate-100 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-6 text-center hover:bg-slate-200 dark:hover:bg-slate-700 flex flex-col items-center justify-center">
                    <img src={imageUrl} alt="Preview" className="max-h-80 w-auto rounded-md object-contain" />
                </div>
            )}
        </div>
        <div className="w-full md:w-1/2 flex flex-col justify-between">
            <div>
              <h3 className="text-2xl font-bold mb-4 text-slate-700 dark:text-slate-200">الاستخراج بالنقر</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                ارفع صورة تحتوي على نص (مثل مستند ممسوح ضوئيًا أو لقطة شاشة)، وسيقوم الذكاء الاصطناعي باستخراج النص لك.
              </p>
            </div>
            {error && <p role="alert" className="text-red-500 bg-red-100 dark:bg-red-900/50 dark:text-red-300 p-3 rounded-md w-full text-center">{error}</p>}
            <button
                id="primary-action-button"
                title="Cmd/Ctrl + Enter"
                onClick={handleSubmit}
                disabled={isLoading || !file}
                className="w-full bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center"
            >
                {isLoading ? <Spinner /> : 'استخراج النص الآن'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default OcrDoc;