import React, { useState, useCallback } from 'react';
import FileUpload from '../components/FileUpload';
import { getSettings } from '../services/settingsService';
import { extractTextFromPdfChunk } from '../services/aiService';
import { Service } from '../types';
import { PDFDocument } from 'pdf-lib';
import { logger } from '../services/loggerService';

declare global {
    interface Window {
        pdfjsLib: any;
    }
}

declare const docx: any;
declare const JSZip: any;

const LANGUAGES = [
    { code: 'ar', name: 'العربية' },
    { code: 'en', name: 'English' },
    { code: 'tr', name: 'Türkçe' },
    { code: 'fr', name: 'Français' },
    { code: 'zh', name: '中文 (Chinese)' },
    { code: 'de', name: 'Deutsch' },
    { code: 'es', name: 'Español' },
    { code: 'it', name: 'Italiano' },
    { code: 'ja', name: '日本語 (Japanese)' },
];

const SOURCE_LANGUAGES = [
    { code: 'auto', name: 'كشف تلقائي (Auto)' },
    ...LANGUAGES
];

interface FileItem {
    id: string;
    file: File;
    numPages: number;
    status: 'pending' | 'processing' | 'done' | 'error';
    text?: string;
    errorMsg?: string;
    progress?: string;
    startPage?: number;
    endPage?: number;
}

const ExtractTextPdf: React.FC<{ onSelectService: (service: Service) => void; }> = ({ onSelectService }) => {
    const [files, setFiles] = useState<FileItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [globalError, setGlobalError] = useState('');

    // Translation State
    const [isTranslationEnabled, setIsTranslationEnabled] = useState(false);
    const [sourceLang, setSourceLang] = useState('auto');
    const [targetLang, setTargetLang] = useState('ar');

    // Export options
    const [exportFormat, setExportFormat] = useState<'docx' | 'txt'>('docx');
    const [downloadMode, setDownloadMode] = useState<'zip' | 'individual'>('zip');

    const handleFileSelect = useCallback(async (selectedFiles: File[]) => {
        const validFiles = selectedFiles.filter(f => f.type === 'application/pdf');
        if (validFiles.length === 0) {
            setGlobalError('يرجى اختيار ملف PDF صالح.');
            return;
        }

        setGlobalError('');
        const newItems: FileItem[] = [];
        
        for (const f of validFiles) {
            try {
                const arrayBuffer = await f.arrayBuffer();
                const pdfDoc = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                newItems.push({
                    id: Math.random().toString(36).substring(2, 9),
                    file: f,
                    numPages: pdfDoc.numPages,
                    startPage: 1,
                    endPage: pdfDoc.numPages,
                    status: 'pending'
                });
            } catch (e) {
                console.error("Error reading PDF metadata for", f.name, e);
                setGlobalError((prev) => prev + `\nفشل قراءة ملف: ${f.name}`);
            }
        }

        setFiles(prev => [...prev, ...newItems]);
    }, []);

    const removeFile = (id: string) => {
        setFiles(prev => prev.filter(f => f.id !== id));
    };

    const updateFilePageRange = (id: string, startPage: number, endPage: number) => {
        setFiles(prev => prev.map(f => f.id === id ? { ...f, startPage, endPage } : f));
    };

    const retryFile = (id: string) => {
        setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'pending', errorMsg: undefined, progress: undefined } : f));
    };

    const processFileAsPdfChunks = async (fileItem: FileItem): Promise<string> => {
        const { file: fileToProcess, startPage = 1, endPage = fileItem.numPages, id: fileId } = fileItem;
        const arrayBuffer = await fileToProcess.arrayBuffer();
        const originalPdf = await PDFDocument.load(arrayBuffer);
        
        const totalPagesToProcess = endPage - startPage + 1;
        const batchSize = getSettings().pdfChunkSize || 5;
        const totalBatches = Math.ceil(totalPagesToProcess / batchSize);
        
        let fullText = '';

        for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
            const batchStartPage = startPage + (batchIdx * batchSize);
            const batchEndPage = Math.min(batchStartPage + batchSize - 1, endPage);
            const currentBatchNum = batchIdx + 1;

            setFiles(prev => prev.map(f => f.id === fileId ? { 
                ...f, 
                progress: `الدفعة ${currentBatchNum}/${totalBatches} (ص ${batchStartPage}-${batchEndPage})` 
            } : f));

            const subPdf = await PDFDocument.create();
            const pageIndices = [];
            for (let p = batchStartPage; p <= batchEndPage; p++) {
                pageIndices.push(p - 1);
            }
            
            const copiedPages = await subPdf.copyPages(originalPdf, pageIndices);
            copiedPages.forEach(page => subPdf.addPage(page));

            const pdfBase64 = await subPdf.saveAsBase64();
            const pdfPart = { inlineData: { data: pdfBase64, mimeType: "application/pdf" } };
            
            const translationConfig = isTranslationEnabled ? { source: sourceLang, target: targetLang } : undefined;
            
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout: AI service took too long to respond.')), 900000)
            );

            const batchResult = await Promise.race([
                extractTextFromPdfChunk(pdfPart, translationConfig),
                timeoutPromise
            ]) as string;
            
            fullText += (fullText ? '\n\n' : '') + batchResult;
        }
        return fullText;
    };

    const handleExtract = async () => {
        if (files.length === 0) return;
        setIsProcessing(true);
        setGlobalError('');

        for (let i = 0; i < files.length; i++) {
            const currentFile = files[i];
            if (currentFile.status === 'done') continue;

            setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'processing', progress: 'جاري البدء...' } : f));
            
            try {
                const text = await processFileAsPdfChunks(currentFile);
                setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'done', text, progress: 'اكتمل' } : f));
                logger.success(`اكتملت معالجة ملف: ${currentFile.file.name}`);
            } catch (err: any) {
                console.error(`Error processing ${currentFile.file.name}:`, err);
                setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', errorMsg: err.message } : f));
                logger.error(`فشل معالجة ملف: ${currentFile.file.name}`, err.message);
            }
        }
        setIsProcessing(false);
    };

    const generateDocxBlob = async (text: string) => {
        if (typeof docx === 'undefined') throw new Error('مكتبة docx غير محملة.');
        const doc = new docx.Document({
            sections: [{
                properties: {},
                children: text.split('\n').map((line: string) => new docx.Paragraph({
                    children: [new docx.TextRun({ text: line, rightToLeft: true })],
                    bidirectional: true
                }))
            }]
        });
        return await docx.Packer.toBlob(doc);
    };

    const handleDownload = async () => {
        const doneFiles = files.filter(f => f.status === 'done' && f.text);
        if (doneFiles.length === 0) return;

        try {
            const { saveFile } = await import('../services/platformService');

            if (downloadMode === 'zip') {
                if (typeof JSZip === 'undefined') throw new Error('مكتبة JSZip غير محملة.');
                const zip = new JSZip();
                
                for (const f of doneFiles) {
                    const originalName = f.file.name.substring(0, f.file.name.lastIndexOf('.')) || f.file.name;
                    let suffix = '_Extracted';
                    if (isTranslationEnabled) suffix += `_Translated_${targetLang.toUpperCase()}`;
                    const ext = exportFormat === 'docx' ? '.docx' : '.txt';
                    const fileName = `${originalName}${suffix}${ext}`;

                    let blob: Blob;
                    if (exportFormat === 'docx') {
                        blob = await generateDocxBlob(f.text!);
                    } else {
                        blob = new Blob([f.text!], { type: 'text/plain;charset=utf-8' });
                    }
                    zip.file(fileName, blob);
                }

                const zipBlob = await zip.generateAsync({ type: 'blob' });
                const buffer = new Uint8Array(await zipBlob.arrayBuffer());
                await saveFile(`Extracted_Texts_${new Date().getTime()}.zip`, buffer);

            } else {
                for (const f of doneFiles) {
                    const originalName = f.file.name.substring(0, f.file.name.lastIndexOf('.')) || f.file.name;
                    let suffix = '_Extracted';
                    if (isTranslationEnabled) suffix += `_Translated_${targetLang.toUpperCase()}`;
                    const ext = exportFormat === 'docx' ? '.docx' : '.txt';
                    const fileName = `${originalName}${suffix}${ext}`;

                    let blob: Blob;
                    if (exportFormat === 'docx') {
                        blob = await generateDocxBlob(f.text!);
                    } else {
                        blob = new Blob([f.text!], { type: 'text/plain;charset=utf-8' });
                    }
                    const buffer = new Uint8Array(await blob.arrayBuffer());
                    await saveFile(fileName, buffer);
                    // Small delay to allow browser to trigger multiple downloads gracefully
                    await new Promise(res => setTimeout(res, 500));
                }
            }
        } catch (e: any) {
            console.error("Download failed:", e);
            setGlobalError(`فشل التنزيل: ${e.message}`);
        }
    };

    const hasPending = files.some(f => f.status === 'pending');
    const hasDone = files.some(f => f.status === 'done');

    return (
        <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold mb-6 text-slate-800 dark:text-slate-100">
                استخراج النص (المعالجة المجمعة)
            </h2>

            <div className="space-y-8">
                {/* 1. File Upload */}
                <div>
                    <h3 className="text-lg font-semibold mb-3 text-slate-700 dark:text-slate-300">1. إضافة ملفات PDF</h3>
                    <FileUpload
                        onFileSelect={handleFileSelect}
                        acceptedFileTypes=".pdf"
                        multiple={true}
                        promptText="اسحب وأفلت ملفات PDF هنا أو انقر للاختيار"
                    />
                </div>

                {globalError && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border-r-4 border-red-500 text-red-700 dark:text-red-200 rounded whitespace-pre-wrap">
                        {globalError}
                    </div>
                )}

                {/* 2. File List */}
                {files.length > 0 && (
                    <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-lg border dark:border-slate-700 space-y-6">
                        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">قائمة الملفات ({files.length})</h3>
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                            {files.map((fileItem, index) => (
                                <div key={fileItem.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded shadow-sm">
                                    <div className="flex flex-col overflow-hidden w-full pr-4">
                                        <span className="font-medium text-slate-700 dark:text-slate-200 truncate" title={fileItem.file.name}>
                                            {index + 1}. {fileItem.file.name}
                                        </span>
                                        <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                                            <span>{fileItem.numPages} صفحة</span>
                                            <span>•</span>
                                            {fileItem.status === 'pending' && <span className="text-amber-600">في الانتظار</span>}
                                            {fileItem.status === 'processing' && <span className="text-blue-600 animate-pulse">{fileItem.progress || 'جاري المعالجة...'}</span>}
                                            {fileItem.status === 'done' && <span className="text-green-600">✓ مكتمل</span>}
                                            {fileItem.status === 'error' && <span className="text-red-600" title={fileItem.errorMsg}>✗ خطأ</span>}
                                        </div>
                                        {files.length === 1 && fileItem.status !== 'processing' && fileItem.status !== 'done' && (
                                            <div className="flex items-center gap-3 mt-3 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <label className="text-slate-600 dark:text-slate-400">من صفحة:</label>
                                                    <input 
                                                        type="number" 
                                                        min={1} 
                                                        max={fileItem.endPage || fileItem.numPages}
                                                        value={fileItem.startPage || 1}
                                                        onChange={e => updateFilePageRange(fileItem.id, parseInt(e.target.value) || 1, fileItem.endPage || fileItem.numPages)}
                                                        className="w-20 p-1 border rounded dark:bg-slate-700 dark:border-slate-600 text-center"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-slate-600 dark:text-slate-400">إلى صفحة:</label>
                                                    <input 
                                                        type="number" 
                                                        min={fileItem.startPage || 1} 
                                                        max={fileItem.numPages}
                                                        value={fileItem.endPage || fileItem.numPages}
                                                        onChange={e => updateFilePageRange(fileItem.id, fileItem.startPage || 1, parseInt(e.target.value) || fileItem.numPages)}
                                                        className="w-20 p-1 border rounded dark:bg-slate-700 dark:border-slate-600 text-center"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {fileItem.status === 'error' && (
                                            <button
                                                onClick={() => retryFile(fileItem.id)}
                                                className="px-3 py-1.5 text-sm font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50 rounded-lg transition-colors"
                                                title="إعادة المحاولة"
                                            >
                                                إعادة المحاولة
                                            </button>
                                        )}
                                        {fileItem.status !== 'processing' && (
                                            <button
                                                onClick={() => removeFile(fileItem.id)}
                                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"
                                                title="إزالة الملف"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Translation Options */}
                        <div className="pt-4 border-t dark:border-slate-700">
                            <div className="flex items-center gap-2 mb-4">
                                <input
                                    type="checkbox"
                                    id="translate-check"
                                    checked={isTranslationEnabled}
                                    onChange={(e) => setIsTranslationEnabled(e.target.checked)}
                                    disabled={isProcessing}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <label htmlFor="translate-check" className="font-semibold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                                    ترجمة النص المستخرج فورياً (ينطبق على جميع الملفات)
                                </label>
                            </div>

                            {isTranslationEnabled && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white dark:bg-slate-800 p-4 rounded border dark:border-slate-600">
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-500">من اللغة:</label>
                                        <select
                                            value={sourceLang}
                                            onChange={(e) => setSourceLang(e.target.value)}
                                            disabled={isProcessing}
                                            className="w-full p-2 text-sm border rounded dark:bg-slate-700 dark:border-slate-600"
                                        >
                                            {SOURCE_LANGUAGES.map(l => (
                                                <option key={l.code} value={l.code}>{l.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-500">إلى اللغة:</label>
                                        <select
                                            value={targetLang}
                                            onChange={(e) => setTargetLang(e.target.value)}
                                            disabled={isProcessing}
                                            className="w-full p-2 text-sm border rounded dark:bg-slate-700 dark:border-slate-600"
                                        >
                                            {LANGUAGES.map(l => (
                                                <option key={l.code} value={l.code}>{l.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        {hasPending && (
                            <button
                                onClick={handleExtract}
                                disabled={isProcessing}
                                className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-slate-400 transition-colors shadow-md"
                            >
                                {isProcessing ? 'جاري معالجة الدفعة...' : 'بدء الاستخراج للملفات المعلقة'}
                            </button>
                        )}
                        
                        {/* Download Section */}
                        {hasDone && !isProcessing && (
                            <div className="pt-6 border-t dark:border-slate-700 space-y-4">
                                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">تحميل النتائج</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-500">صيغة التنزيل:</label>
                                        <select
                                            value={exportFormat}
                                            onChange={(e) => setExportFormat(e.target.value as any)}
                                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700"
                                        >
                                            <option value="docx">Word (.docx)</option>
                                            <option value="txt">Text (.txt)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-500">طريقة التنزيل:</label>
                                        <select
                                            value={downloadMode}
                                            onChange={(e) => setDownloadMode(e.target.value as any)}
                                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700"
                                        >
                                            <option value="zip">ملف واحد مضغوط (.zip)</option>
                                            <option value="individual">تنزيل كل ملف على حدة</option>
                                        </select>
                                    </div>
                                </div>
                                <button
                                    onClick={handleDownload}
                                    className="w-full py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors shadow-md"
                                >
                                    تنزيل النتائج المكتملة
                                </button>
                                <button
                                    onClick={() => setFiles([])}
                                    className="w-full py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    مسح القائمة والبدء من جديد
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExtractTextPdf;
