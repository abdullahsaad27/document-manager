// This service manages a web worker for heavy PDF processing tasks.

let pdfWorker: Worker | null = null;
let taskCounter = 0;
const activeTasks = new Map<number, { resolve: (result: Blob) => void; reject: (error: Error) => void }>();

// The entire worker code is defined as a template string to be converted into a Blob,
// avoiding the need for a separate worker file and build system configuration.
const workerCode = `
self.importScripts('https://cdn.jsdelivr.net/npm/pdf-lib/dist/pdf-lib.min.js');
self.importScripts('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');

self.onmessage = async (e) => {
    const { id, operation, payload } = e.data;
    const { PDFDocument } = self.PDFLib;
    
    try {
        let resultBytes;

        switch(operation) {
            case 'merge': {
                self.postMessage({ id, type: 'progress', message: 'جاري إنشاء مستند جديد...' });
                const mergedPdf = await PDFDocument.create();
                for (let i = 0; i < payload.files.length; i++) {
                    self.postMessage({ id, type: 'progress', message: \`جاري إضافة الملف \${i + 1} من \${payload.files.length}...\` });
                    const pdf = await PDFDocument.load(await payload.files[i].arrayBuffer(), { ignoreEncryption: true });
                    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                    copiedPages.forEach((page) => mergedPdf.addPage(page));
                }
                resultBytes = await mergedPdf.save();
                break;
            }
            case 'split': {
                 self.postMessage({ id, type: 'progress', message: 'جاري قراءة الملف الأصلي...' });
                const zip = new self.JSZip();
                const originalPdfDoc = await PDFDocument.load(await payload.file.arrayBuffer(), { ignoreEncryption: true });

                for (let i = 0; i < payload.ranges.length; i++) {
                    const range = payload.ranges[i];
                    self.postMessage({ id, type: 'progress', message: \`جاري إنشاء النطاق \${i + 1} (\${range.from}-\${range.to})...\` });
                    const newPdfDoc = await PDFDocument.create();
                    const pageIndices = Array.from({ length: range.to - range.from + 1 }, (_, k) => k + range.from - 1);
                    const copiedPages = await newPdfDoc.copyPages(originalPdfDoc, pageIndices);
                    copiedPages.forEach(page => newPdfDoc.addPage(page));
                    const pdfBytes = await newPdfDoc.save();
                    zip.file(\`split_pages_\${range.from}-\${range.to}_\${payload.file.name}\`, pdfBytes);
                }
                self.postMessage({ id, type: 'progress', message: 'جاري ضغط الملفات...' });
                resultBytes = await zip.generateAsync({ type: 'uint8array' });
                break;
            }
            case 'compress': {
                self.postMessage({ id, type: 'progress', message: 'جاري قراءة الملف...' });
                const pdfDoc = await PDFDocument.load(await payload.file.arrayBuffer(), { ignoreEncryption: true });
                const quality = payload.quality || 'medium'; // high, medium, low

                if (quality === 'low') { // Extreme compression
                    try {
                        const form = pdfDoc.getForm();
                        // Check if the document has a form and if it has fields
                        if (form && form.getFields().length > 0) {
                            self.postMessage({ id, type: 'progress', message: 'جاري تسوية حقول النموذج لتقليل الحجم...' });
                            form.flatten();
                        }
                    } catch(e) {
                        // Ignore if no form or error during flattening.
                        console.warn('Could not flatten form, or no form exists.');
                    }
                }

                // useObjectStreams is a key compression feature. We disable it only for 'high' quality (basic compression).
                const useObjectStreams = quality !== 'high';
                self.postMessage({ id, type: 'progress', message: \`جاري الحفظ بضغط \${quality === 'high' ? 'أساسي' : 'محسن'}...\` });
                resultBytes = await pdfDoc.save({ useObjectStreams });
                break;
            }
            case 'encrypt':
            case 'decrypt': {
                self.postMessage({ id, type: 'progress', message: 'جاري معالجة الحماية...' });
                const options = { ignoreEncryption: true };
                if (operation === 'decrypt') {
                    options.password = payload.password;
                }
                const pdfDoc = await PDFDocument.load(await payload.file.arrayBuffer(), options);
                const saveOptions = operation === 'encrypt' ? { userPassword: payload.password, ownerPassword: payload.password } : {};
                resultBytes = await pdfDoc.save(saveOptions);
                break;
            }
            case 'images-to-pdf': {
                 const { PageSizes } = self.PDFLib;
                const pdfDoc = await PDFDocument.create();
                for (let i = 0; i < payload.files.length; i++) {
                    self.postMessage({ id, type: 'progress', message: \`جاري إضافة الصورة \${i + 1} من \${payload.files.length}...\` });
                    const file = payload.files[i];
                    let image;
                    if (file.type === 'image/jpeg') {
                        image = await pdfDoc.embedJpg(await file.arrayBuffer());
                    } else {
                        image = await pdfDoc.embedPng(await file.arrayBuffer());
                    }
                    const page = pdfDoc.addPage(PageSizes.A4);
                    const { width, height } = image.scaleToFit(page.getWidth(), page.getHeight());
                    page.drawImage(image, { x: page.getWidth() / 2 - width / 2, y: page.getHeight() / 2 - height / 2, width, height });
                }
                resultBytes = await pdfDoc.save();
                break;
            }
            default:
                throw new Error(\`Unknown operation: \${operation}\`);
        }
        
        self.postMessage({ id, type: 'result', payload: resultBytes });

    } catch(err) {
        self.postMessage({ id, type: 'error', message: err.message });
    }
};
`;

const getWorker = (): Worker => {
    if (!pdfWorker) {
        const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
        pdfWorker = new Worker(URL.createObjectURL(workerBlob));
        
        pdfWorker.onmessage = (e) => {
            const { id, type, payload, message } = e.data;
            if (!activeTasks.has(id)) return;

            const task = activeTasks.get(id)!;
            switch(type) {
                case 'result':
                    task.resolve(new Blob([payload]));
                    activeTasks.delete(id);
                    break;
                case 'error':
                    task.reject(new Error(message));
                    activeTasks.delete(id);
                    break;
                case 'progress':
                    if (typeof e.data.setProgress === 'function') {
                       e.data.setProgress(message);
                    }
                    break;
            }
        };

        pdfWorker.onerror = (e) => {
            console.error('Error in PDF worker:', e);
            // Reject all active tasks
            for (const [id, task] of activeTasks.entries()) {
                task.reject(new Error(`Worker error: ${e.message}`));
                activeTasks.delete(id);
            }
        };
    }
    return pdfWorker;
};

export const processPdf = (
    payload: { operation: string; [key: string]: any },
    setProgress: (message: string) => void
): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const id = taskCounter++;
        const worker = getWorker();

        // The setProgress function cannot be passed to the worker directly.
        // Instead, the worker posts 'progress' messages back.
        const messageHandler = (e: MessageEvent) => {
            if (e.data.id === id && e.data.type === 'progress') {
                setProgress(e.data.message);
            }
        };
        worker.addEventListener('message', messageHandler);

        activeTasks.set(id, {
            resolve: (result) => {
                worker.removeEventListener('message', messageHandler);
                resolve(result);
            },
            reject: (error) => {
                worker.removeEventListener('message', messageHandler);
                reject(error);
            }
        });

        worker.postMessage({ id, operation: payload.operation, payload });
    });
};