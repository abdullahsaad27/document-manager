import React, { useState } from 'react';
import Spinner from '../components/Spinner';

declare const PDFLib: any;

const DecryptPdf: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setError('');
      setSuccess(false);
    }
  };

  const handleDecrypt = async () => {
    if (!file) {
      setError('الرجاء اختيار ملف أولاً.');
      return;
    }
    if (!password) {
      setError('الرجاء إدخال كلمة المرور لفك التشفير.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess(false);

    try {
      const { PDFDocument } = PDFLib;
      const arrayBuffer = await file.arrayBuffer();
      
      const pdfDoc = await PDFDocument.load(arrayBuffer, {
        password: password,
        ignoreEncryption: true,
      });
      
      const pdfBytes = await pdfDoc.save();
      
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `decrypted-${file.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      setSuccess(true);
      setFile(null);
      setPassword('');

    } catch (err: unknown) {
      setError('فشل فك تشفير الملف. يرجى التأكد من صحة كلمة المرور وأن الملف غير تالف.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-lg">
      <div className="flex flex-col items-center">
        <label htmlFor="file-upload" className="w-full cursor-pointer bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg p-10 text-center hover:bg-slate-200 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-slate-400 mb-2"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>
          <span className="text-slate-600 font-semibold">{file ? file.name : 'اسحب وأفلت ملف PDF هنا أو انقر للاختيار'}</span>
        </label>
        <input id="file-upload" type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
        
        <div className="mt-6 w-full">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">كلمة المرور</label>
            <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة مرور الملف"
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>

        <button
          onClick={handleDecrypt}
          disabled={isLoading || !file || !password}
          className="mt-6 bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center w-48"
        >
          {isLoading ? <Spinner /> : 'فك التشفير'}
        </button>
        
        {error && <p className="mt-4 text-red-500 bg-red-100 p-3 rounded-md w-full text-center">{error}</p>}
        {success && <p className="mt-4 text-green-500 bg-green-100 p-3 rounded-md w-full text-center">تم فك تشفير الملف بنجاح وجاري تنزيله.</p>}
      </div>
    </div>
  );
};

export default DecryptPdf;