// services/textExtractorService.ts

// This service is now worker-free to avoid cross-origin/blob security issues.
// All processing happens on the main thread, with progress updates to keep the UI responsive.

/**
 * Extracts text from a file (PDF, DOCX, TXT) directly on the main thread.
 * @param file The file to process.
 * @param onProgress A callback function to receive progress updates.
 * @returns A promise that resolves with the extracted text.
 */
export const extractTextFromFile = async (
    file: File,
    onProgress: (message: string) => void
): Promise<string> => {
    const fileBuffer = await file.arrayBuffer();
    const fileType = file.type;
    
    try {
        let fullText = '';
        if (fileType === 'application/pdf') {
            const globalPDFLib = (window as any).PDFLib;
            const globalPdfjsLib = (window as any).pdfjsLib;

            if (!globalPDFLib) throw new Error("مكتبة PDFLib لم يتم تحميلها. يرجى التحقق من الاتصال وتحديث الصفحة.");
            if (!globalPdfjsLib) throw new Error("مكتبة PDF.js لم يتم تحميلها. يرجى التحقق من الاتصال وتحديث الصفحة.");

            onProgress('جاري إصلاح بنية ملف PDF...');
            const { PDFDocument } = globalPDFLib;
            let repairedBytes;
             try {
                const originalDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
                const newDoc = await PDFDocument.create();
                const copiedPages = await newDoc.copyPages(originalDoc, originalDoc.getPageIndices());
                copiedPages.forEach((page: any) => newDoc.addPage(page));
                 try {
                    const form = newDoc.getForm();
                    if (form.getFields().length > 0) form.flatten();
                } catch(e) { /* ignore */ }
                repairedBytes = await newDoc.save();
            } catch (repairError) {
                console.error("PDF repair failed, proceeding with original file.", repairError);
                repairedBytes = fileBuffer; // Fallback to original if repair fails
            }

            onProgress('جاري قراءة ملف PDF...');
            const pdf = await globalPdfjsLib.getDocument({ data: repairedBytes, verbosity: 1 }).promise;
            const numPages = pdf.numPages;
            for (let i = 1; i <= numPages; i++) {
                onProgress(`جاري قراءة الصفحة ${i} من ${numPages}...`);
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                fullText += content.items.map((item: any) => item.str).join(' ') + '\n';
            }
        } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const globalMammoth = (window as any).mammoth;
            if (!globalMammoth) throw new Error("مكتبة Mammoth لم يتم تحميلها.");

            onProgress('جاري استخراج النص من مستند Word...');
            const result = await globalMammoth.extractRawText({ arrayBuffer: fileBuffer });
            fullText = result.value;
        } else if (fileType === 'text/plain') {
            onProgress('جاري قراءة الملف النصي...');
            fullText = new TextDecoder().decode(fileBuffer);
        } else {
            throw new Error('Unsupported file type for text extraction.');
        }

        return fullText;

    } catch(err: any) {
        console.error("Text extraction failed:", err);
        const message = err.message || 'An unknown error occurred during text extraction.';
        if (message.includes('Password') || message.includes('encrypted')) {
            throw new Error('فشل استخراج النص. قد يكون الملف محميًا بكلمة مرور.');
        }
        throw new Error(`فشل استخراج النص: ${message}`);
    }
};