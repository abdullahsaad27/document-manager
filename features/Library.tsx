import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initDB, getDocuments, saveDocument, deleteDocument } from '../services/database';
import type { LibraryDocument } from '../types';
import Spinner from '../components/Spinner';
import ConfirmationModal from '../components/ConfirmationModal';

interface LibraryProps {
  onViewDocument: (doc: LibraryDocument) => void;
}

const fileTypeMap: { [key: string]: string } = {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
    'text/plain': 'TXT',
    'image/png': 'PNG',
    'image/jpeg': 'JPG',
    'image/webp': 'WEBP',
};

const getDisplayType = (doc: LibraryDocument): string => {
    if (doc.documentType === 'summary') return 'ملخص';
    if (doc.documentType === 'analysis') return 'تحليل';
    return fileTypeMap[doc.fileType] || doc.fileType.split('/').pop()?.toUpperCase() || 'أصلي';
};


const Library: React.FC<LibraryProps> = ({ onViewDocument }) => {
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('الكل');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [docToDeleteId, setDocToDeleteId] = useState<number | null>(null);

  const loadDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      await initDB();
      const docs = await getDocuments();
      setDocuments(docs);
    } catch (err) {
      setError('فشل تحميل المكتبة. يرجى تحديث الصفحة.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);
  
  const handleDeleteRequest = (id: number) => {
    setDocToDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (docToDeleteId === null) return;
    try {
        await deleteDocument(docToDeleteId);
        setDocuments(docs => docs.filter(doc => doc.id !== docToDeleteId));
    } catch (err) {
        setError('فشل حذف المستند.');
    } finally {
        setIsDeleteModalOpen(false);
        setDocToDeleteId(null);
    }
  };

  const cancelDelete = () => {
    setIsDeleteModalOpen(false);
    setDocToDeleteId(null);
  };

  const handleExport = (doc: LibraryDocument) => {
    const docx = (window as any).docx;
    if (!docx || !docx.Document || !docx.Paragraph || !docx.Packer) {
        setError("مكتبة تصدير Word غير متاحة أو لم يتم تحميلها بالكامل. يرجى التحقق من اتصالك بالإنترنت وتحديث الصفحة.");
        return;
    }
    
    try {
        const children = doc.content.map(item => {
            if (item.type === 'heading') {
                const level = Math.max(1, Math.min(6, item.level || 2));
                return new docx.Paragraph({
                    text: item.content,
                    heading: docx.HeadingLevel[`HEADING_${level}`] || `Heading${level}`,
                    bidirectional: true,
                });
            }
            return new docx.Paragraph({
                text: item.content,
                bidirectional: true,
            });
        });

        const docxDoc = new docx.Document({
            sections: [{
                children: children,
            }],
        });

        docx.Packer.toBlob(docxDoc).then((blob: Blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${doc.name.split('.')[0]}.docx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        });
    } catch (e: any) {
        setError(`حدث خطأ أثناء التصدير: ${e.message}`);
    }
  }

  const filters = useMemo(() => {
    const counts = {
      'الكل': documents.length,
      'ملخص': documents.filter(d => d.documentType === 'summary').length,
      'تحليل': documents.filter(d => d.documentType === 'analysis').length,
    };
    return Object.entries(counts).filter(([, count]) => count > 0);
  }, [documents]);


  const filteredDocuments = documents.filter(doc => {
    // Category filter first
    const docTypeDisplay = getDisplayType(doc);
    if (activeFilter !== 'الكل') {
        if (activeFilter === 'ملخص' && doc.documentType !== 'summary') return false;
        if (activeFilter === 'تحليل' && doc.documentType !== 'analysis') return false;
    }

    // Then search query
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();

    // Check document name
    const nameMatch = doc.name.toLowerCase().includes(query);
    if (nameMatch) return true;
    
    // Check source file name for summaries/analyses
    if (doc.sourceFileName && doc.sourceFileName.toLowerCase().includes(query)) return true;

    // Check document content
    const contentMatch = doc.content.some(item =>
      item.content.toLowerCase().includes(query)
    );
    if (contentMatch) return true;

    return false;
  });

  if (isLoading) {
    return <div className="flex justify-center items-center p-8"><Spinner /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg">
        <div className="flex justify-between items-center mb-4 border-b dark:border-slate-700 pb-4">
            <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-100">مستنداتك المحفوظة</h2>
        </div>

        <div className="mb-6">
            <div className="relative">
                <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                </span>
                <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث بالاسم أو المحتوى..."
                    className="w-full p-3 pr-10 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700"
                    aria-label="ابحث في المكتبة"
                />
            </div>
        </div>
        
        {documents.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-6 border-t dark:border-slate-700 pt-4">
                <span className="font-semibold text-slate-600 dark:text-slate-300">تصفية حسب النوع:</span>
                {filters.map(([filterName, count]) => (
                    <button
                        key={filterName}
                        onClick={() => setActiveFilter(filterName)}
                        className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                            activeFilter === filterName
                                ? 'bg-blue-600 text-white shadow'
                                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'
                        }`}
                    >
                        {filterName}
                        <span className={`text-xs rounded-full px-1.5 py-0.5 ${
                            activeFilter === filterName ? 'bg-white/20' : 'bg-slate-300 dark:bg-slate-600'
                        }`}>
                            {count}
                        </span>
                    </button>
                ))}
            </div>
        )}

        {error && <p role="alert" className="mb-4 text-red-500 bg-red-100 dark:bg-red-900/50 dark:text-red-300 p-3 rounded-md w-full text-center">{error}</p>}
        
        <div role="status">
            {documents.length === 0 ? (
                <p className="text-center text-slate-500 dark:text-slate-400 py-8">مكتبتك فارغة. قم بتحليل مستند جديد واحفظه هنا!</p>
            ) : filteredDocuments.length === 0 ? (
                <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                     {searchQuery.trim()
                        ? `لم يتم العثور على مستندات تطابق بحثك "${searchQuery}" ضمن فلتر "${activeFilter}".`
                        : `لا توجد مستندات من نوع "${activeFilter}".`}
                </p>
            ) : (
                <ul className="space-y-4">
                    {filteredDocuments.map(doc => (
                        <li key={doc.id} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all hover:shadow-md hover:bg-slate-100 dark:hover:bg-slate-700">
                            <div className="flex-grow min-w-0">
                                <p className="font-bold text-slate-800 dark:text-slate-100 truncate flex items-center gap-2" title={doc.name}>
                                    <span className={`text-xs font-bold py-0.5 px-2 rounded-full ${doc.documentType === 'summary' ? 'bg-amber-200 text-amber-800' : doc.documentType === 'analysis' ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-200 text-slate-600'}`}>
                                        {getDisplayType(doc)}
                                    </span>
                                    <span>{doc.name}</span>
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {doc.sourceFileName && `(المصدر: ${doc.sourceFileName}) - `}
                                    تم الحفظ في: {new Date(doc.createdAt).toLocaleDateString('ar-EG')}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <button onClick={() => onViewDocument(doc)} className="bg-green-100 text-green-800 font-semibold py-1 px-3 rounded-md hover:bg-green-200 dark:bg-green-900/40 dark:text-green-200 dark:hover:bg-green-900/60">فتح</button>
                                <button onClick={() => handleExport(doc)} className="bg-sky-100 text-sky-800 font-semibold py-1 px-3 rounded-md hover:bg-sky-200 dark:bg-sky-900/40 dark:text-sky-200 dark:hover:bg-sky-900/60">تصدير كـ Word</button>
                                <button onClick={() => handleDeleteRequest(doc.id!)} className="bg-red-100 text-red-800 font-semibold py-1 px-3 rounded-md hover:bg-red-200 dark:bg-red-900/40 dark:text-red-200 dark:hover:bg-red-900/60">حذف</button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
        <ConfirmationModal
            isOpen={isDeleteModalOpen}
            title="تأكيد الحذف"
            message="هل أنت متأكد من أنك تريد حذف هذا المستند؟ لا يمكن التراجع عن هذا الإجراء."
            onConfirm={confirmDelete}
            onCancel={cancelDelete}
            confirmText="نعم، احذف"
            cancelText="إلغاء"
            confirmButtonClass="bg-red-600 hover:bg-red-700"
        />
    </div>
  );
};

export default Library;