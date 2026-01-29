import React, { useState, useCallback } from 'react';
import FileUpload from '../components/FileUpload';
import { getSettings } from '../services/settingsService';
import { extractTextFromPdfChunk } from '../services/aiService'; // Updated import
import { Service } from '../types';
import { PDFDocument } from 'pdf-lib';
import { logger } from '../services/loggerService';

// We assume pdfjsLib is available on window
declare global {
    interface Window {
        pdfjsLib: any;
    }
}

declare const docx: any;

// Helper to encode Uint8Array to Base64 (needed if we extracted raw bytes, but canvas gives us dataUrl directly)
// We kept it just in case, but main logic uses canvas.toDataURL

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

const ExtractTextPdf: React.FC<{ onSelectService: (service: Service) => void; }> = ({ onSelectService }) => {
    const [processedText, setProcessedText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState('');
    const [error, setError] = useState('');
    const [failedBatch, setFailedBatch] = useState<{ index: number; error: string } | null>(null);

    // File processing state
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [numPages, setNumPages] = useState<number>(0);
    const [rangeStart, setRangeStart] = useState<number>(1);
    const [rangeEnd, setRangeEnd] = useState<number>(1);
    
    // Translation State
    const [isTranslationEnabled, setIsTranslationEnabled] = useState(false);
    const [sourceLang, setSourceLang] = useState('auto');
    const [targetLang, setTargetLang] = useState('ar');

    // Export options
    const [exportFormat, setExportFormat] = useState<'docx' | 'txt'>('docx');


    const handleFileSelect = useCallback(async (selectedFiles: File[]) => {
        const validFiles = selectedFiles.filter(f => f.type === 'application/pdf');
        if (validFiles.length === 0) {
            setError('يرجى اختيار ملف PDF صالح.');
            return;
        }

        const file = validFiles[0];
        setSelectedFile(file);
        setError('');
        setProcessedText('');
        setFailedBatch(null);
        setProgress('جاري قراءة الملف...');

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            setNumPages(pdfDoc.numPages);
            setRangeStart(1);
            setRangeEnd(pdfDoc.numPages);
            setProgress('');
        } catch (e) {
            console.error("Error reading PDF metadata:", e);
            setError("فشل في قراءة ملف PDF. تأكد من أن الملف غير تالف.");
            setSelectedFile(null);
        }

    }, []);

    const processFileAsPdfChunks = async (fileToProcess: File, startBatchIdx: number = 0): Promise<void> => {
        const arrayBuffer = await fileToProcess.arrayBuffer();
        
        // Load the original PDF
        const originalPdf = await PDFDocument.load(arrayBuffer);
        const totalPdfPages = originalPdf.getPageCount();

        const start = Math.max(1, Math.min(rangeStart, totalPdfPages));
        const end = Math.max(start, Math.min(rangeEnd, totalPdfPages));
        
        // Use global setting for batch size
        const batchSize = getSettings().pdfChunkSize || 5;

        const pagesToProcessCount = end - start + 1;
        const totalBatches = Math.ceil(pagesToProcessCount / batchSize);

        console.log(`[ExtractTextPdf] Processing pages ${start}-${end} (${pagesToProcessCount} pages) in ${totalBatches} chunks (Size: ${batchSize}). Starting from batch ${startBatchIdx}.`);

        // Iterate by batch
        for (let batchIdx = startBatchIdx; batchIdx < totalBatches; batchIdx++) {
            const batchStartPage = start + (batchIdx * batchSize);
            const batchEndPage = Math.min(batchStartPage + batchSize - 1, end);
            const currentBatchNum = batchIdx + 1;

            setProgress(`جاري معالجة الدفعة ${currentBatchNum} من ${totalBatches}. الصفحات ${batchStartPage} إلى ${batchEndPage} من ${totalPdfPages}.`);
            
            try {
                // 1. Create a new PDF document
                // setProgress(`جاري تجهيز الدفعة ${currentBatchNum} (تقسيم الملف)...`); // Removed to reduce flicker, main progress is enough
                const subPdf = await PDFDocument.create();
                
                // 2. Copy pages (pdf-lib uses 0-based indexing)
                const pageIndices = [];
                for (let p = batchStartPage; p <= batchEndPage; p++) {
                    pageIndices.push(p - 1);
                }
                
                const copiedPages = await subPdf.copyPages(originalPdf, pageIndices);
                copiedPages.forEach(page => subPdf.addPage(page));

                // 3. Save as Base64
                const pdfBase64 = await subPdf.saveAsBase64();
                const sizeInMB = (pdfBase64.length * 0.75) / (1024 * 1024);
                
                // 4. Send to AI
                const pdfPart = {
                    inlineData: {
                        data: pdfBase64,
                        mimeType: "application/pdf"
                    }
                };

                console.log(`[ExtractTextPdf] Sending PDF chunk ${currentBatchNum} to AI...`);
                logger.info(`تجهيز الدفعة ${currentBatchNum} للمعالجة`, `الصفحات: ${batchStartPage}-${batchEndPage}, الحجم: ${sizeInMB.toFixed(2)}MB`);
                
                const translationConfig = isTranslationEnabled ? { source: sourceLang, target: targetLang } : undefined;
                
                // Add timeout wrapper (Increased to 900s / 15 mins)
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout: AI service took too long to respond (900s).')), 900000)
                );

                const batchResult = await Promise.race([
                    extractTextFromPdfChunk(pdfPart, translationConfig),
                    timeoutPromise
                ]) as string;
                
                logger.success(`تمت معالجة الدفعة ${currentBatchNum} بنجاح`, `تم استخراج ${batchResult.length} حرف`);
                
                // Update state incrementally
                setProcessedText(prev => prev + (prev ? '\n\n' : '') + batchResult);

            } catch (e: any) {
                console.error(`[ExtractTextPdf] Error processing batch ${currentBatchNum}:`, e);
                const errMsg = e.message || 'Unknown error';
                logger.error(`فشل معالجة الدفعة ${currentBatchNum}`, errMsg);
                setFailedBatch({ index: batchIdx, error: errMsg });
                throw new Error(`فشل معالجة الدفعة ${currentBatchNum}: ${errMsg}`);
            }
        }
    };


    const handleExtract = async () => {
        if (!selectedFile) return;

        setIsProcessing(true);
        setError('');
        setFailedBatch(null);
        setProcessedText(''); // Reset only on fresh start
        
        try {
            await processFileAsPdfChunks(selectedFile, 0);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'حدث خطأ غير متوقع أثناء المعالجة.');
        } finally {
            setIsProcessing(false);
            setProgress('');
        }
    };

    const handleRetry = async () => {
        if (!selectedFile || !failedBatch) return;

        setIsProcessing(true);
        setError('');
        const startIdx = failedBatch.index;
        setFailedBatch(null);

        try {
            await processFileAsPdfChunks(selectedFile, startIdx);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'حدث خطأ غير متوقع أثناء المعالجة.');
        } finally {
            setIsProcessing(false);
            setProgress('');
        }
    };

    const handleDownload = async () => {
        if (!processedText || !selectedFile) return;

        try {
            const { saveFile } = await import('../services/platformService');
            
            // Helper for DOCX generation
            const generateDocxBlob = async (text: string) => {
                if (typeof docx === 'undefined') {
                    throw new Error('مكتبة docx غير محملة.');
                }
                const doc = new docx.Document({
                    sections: [{
                        properties: {},
                        children: text.split('\n').map(line => new docx.Paragraph({
                            children: [new docx.TextRun({ text: line, rightToLeft: true })],
                            bidirectional: true
                        }))
                    }]
                });
                return await docx.Packer.toBlob(doc);
            };

            let blob: Blob;
            let ext: string;
            if (exportFormat === 'docx') {
                blob = await generateDocxBlob(processedText);
                ext = '.docx';
            } else {
                blob = new Blob([processedText], { type: 'text/plain;charset=utf-8' });
                ext = '.txt';
            }

            // Filename generation
            const originalName = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) || selectedFile.name;
            let suffix = '_Extracted';
            if (isTranslationEnabled) {
                suffix += `_Translated_${targetLang.toUpperCase()}`;
            }
            const fileName = `${originalName}${suffix}${ext}`;
            
            const buffer = new Uint8Array(await blob.arrayBuffer());
            await saveFile(fileName, buffer);

        } catch (e: any) {
            console.error("Download failed:", e);
            setError(`فشل التنزيل: ${e.message}`);
        }
    };

    if (isProcessing || processedText || failedBatch) {
        return (
            <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold mb-6 text-slate-800 dark:text-slate-100">
                    {isTranslationEnabled ? 'استخراج وترجمة النص' : 'استخراج النص'}
                </h2>

                {isProcessing && (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-lg text-slate-600 dark:text-slate-300 mb-2">{progress}</p>
                        <p className="text-sm text-slate-500">يرجى عدم إغلاق النافذة أثناء المعالجة.</p>
                    </div>
                )}

                {!isProcessing && failedBatch && (
                     <div className="text-center py-8">
                        <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-200 rounded-lg max-w-2xl mx-auto mb-6">
                            <p className="font-bold mb-2">حدث خطأ أثناء المعالجة:</p>
                            <p>{error}</p>
                        </div>
                        <button
                            onClick={handleRetry}
                            className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transition-transform transform hover:scale-105"
                        >
                            إعادة المحاولة من حيث توقف (الدفعة {failedBatch.index + 1})
                        </button>
                         <button
                            onClick={() => {
                                setProcessedText('');
                                setSelectedFile(null);
                                setNumPages(0);
                                setFailedBatch(null);
                                setError('');
                            }}
                            className="px-6 py-3 mr-4 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                            إلغاء والعودة
                        </button>
                    </div>
                )}

                {!isProcessing && processedText && !failedBatch && (
                    <div className="space-y-6">
                        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border dark:border-slate-700 max-h-[60vh] overflow-y-auto whitespace-pre-wrap dir-rtl">
                            {processedText}
                        </div>

                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-t dark:border-slate-700 pt-6">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">صيغة التنزيل:</label>
                                <select
                                    value={exportFormat}
                                    onChange={(e) => setExportFormat(e.target.value as any)}
                                    className="p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700"
                                >
                                    <option value="docx">Word (.docx)</option>
                                    <option value="txt">Text (.txt)</option>
                                </select>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setProcessedText('');
                                        setSelectedFile(null);
                                        setNumPages(0);
                                    }}
                                    className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
                                >
                                    إلغاء / ملف جديد
                                </button>
                                <button
                                    onClick={handleDownload}
                                    className="px-6 py-2 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700"
                                >
                                    تنزيل النتيجة
                                </button>
                            </div>
                        </div>
                        {error && (
                            <div className="mt-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-200 rounded-lg text-center font-bold">
                                {error}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold mb-6 text-slate-800 dark:text-slate-100">استخراج النص (ويمكن ترجمته)</h2>

            <div className="space-y-8">
                <div>
                    <h3 className="text-lg font-semibold mb-3 text-slate-700 dark:text-slate-300">1. اختيار الملف</h3>
                    <FileUpload
                        onFileSelect={handleFileSelect}
                        acceptedFileTypes=".pdf"
                        multiple={false}
                        promptText="اضغط لاختيار ملف PDF"
                    />
                </div>

                {selectedFile && (
                    <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-lg border dark:border-slate-700 space-y-6">
                        {/* File Info */}
                        <div className="flex justify-between items-center pb-4 border-b dark:border-slate-700">
                            <span className="font-medium text-slate-700 dark:text-slate-200 truncate max-w-[70%]">
                                {selectedFile.name}
                            </span>
                            <span className="text-sm text-slate-500">
                                {numPages} صفحة
                            </span>
                        </div>

                        {/* Configuration Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {/* Range Selection */}
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">نطاق الصفحات:</p>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-slate-500">من</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={numPages}
                                            value={rangeStart}
                                            onChange={(e) => setRangeStart(parseInt(e.target.value) || 1)}
                                            className="w-16 p-2 text-sm border rounded dark:bg-slate-800 dark:border-slate-600"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-slate-500">إلى</label>
                                        <input
                                            type="number"
                                            min={rangeStart}
                                            max={numPages}
                                            value={rangeEnd}
                                            onChange={(e) => setRangeEnd(parseInt(e.target.value) || numPages)}
                                            className="w-16 p-2 text-sm border rounded dark:bg-slate-800 dark:border-slate-600"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Translation Options */}
                        <div className="pt-4 border-t dark:border-slate-700">
                            <div className="flex items-center gap-2 mb-4">
                                <input
                                    type="checkbox"
                                    id="translate-check"
                                    checked={isTranslationEnabled}
                                    onChange={(e) => setIsTranslationEnabled(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <label htmlFor="translate-check" className="font-semibold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                                    ترجمة النص المستخرج فورياً
                                </label>
                            </div>

                            {isTranslationEnabled && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white dark:bg-slate-800 p-4 rounded border dark:border-slate-600 animate-fadeIn">
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-500">من اللغة:</label>
                                        <select
                                            value={sourceLang}
                                            onChange={(e) => setSourceLang(e.target.value)}
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

                        {/* Action Button */}
                        <button
                            onClick={handleExtract}
                            disabled={isProcessing}
                            className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-slate-400 transition-colors shadow-md"
                        >
                            {isProcessing ? 'جاري المعالجة...' : (isTranslationEnabled ? 'استخراج وترجمة' : 'بدء الاستخراج')}
                        </button>
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border-r-4 border-red-500 text-red-700 dark:text-red-200 rounded">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExtractTextPdf;
