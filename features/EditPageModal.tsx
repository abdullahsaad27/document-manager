import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { PageState, TextEdit } from '../types';
import Spinner from '../components/Spinner';
import { editPageTextWithAI } from '../services/aiService';
import { ApiLimitError } from '../services/aiService';
import { InterruptedTask } from '../AppContext';

type EditMode = 'visual' | 'form';

interface EditPageModalProps {
  pageState: PageState;
  pdfPage: any;
  pageNumber: number;
  onClose: () => void;
  onSave: (pageIndex: number, edits: TextEdit, formText?: string) => void;
  mode: EditMode;
  setInterruptedTask: (task: InterruptedTask | null) => void;
  file: File | null; // Needed for context
}

const EditPageModal: React.FC<EditPageModalProps> = ({ pageState, pdfPage, pageNumber, onClose, onSave, mode, setInterruptedTask, file }) => {
  const [edits, setEdits] = useState<TextEdit>(pageState.edits);
  const [activeEditId, setActiveEditId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1);
  const [formText, setFormText] = useState('');

  // AI Assistant State
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    
    // Delay focus slightly to ensure modal is fully rendered and transitions are complete
    setTimeout(() => {
        const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button, textarea, input, select'
        );
        (focusableElements?.[0] as HTMLElement)?.focus();
    }, 100);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>(
          'a[href]:not([disabled]), button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled])'
        ));
        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey) { // Shift + Tab
          if (document.activeElement === firstElement) {
            (lastElement as HTMLElement).focus();
            e.preventDefault();
          }
        } else { // Tab
          if (document.activeElement === lastElement) {
            (firstElement as HTMLElement).focus();
            e.preventDefault();
          }
        }
      } else if (e.key === 'Escape') {
          onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  const renderPage = useCallback(async () => {
    if (mode !== 'visual' || !pdfPage || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;
    
    const containerWidth = canvas.parentElement?.clientWidth || 800;
    const initialViewport = pdfPage.getViewport({ scale: 1 });
    const newScale = Math.min(1.5, containerWidth / initialViewport.width); // Cap scale at 1.5
    setScale(newScale);

    const viewport = pdfPage.getViewport({ scale: newScale });
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await pdfPage.render({ canvasContext: context, viewport }).promise;
  }, [pdfPage, mode]);

  useEffect(() => {
    renderPage();
    window.addEventListener('resize', renderPage);
    return () => window.removeEventListener('resize', renderPage);
  }, [renderPage]);

  useEffect(() => {
    if (mode === 'form') {
      if (pageState.formTextEdit) {
        setFormText(pageState.formTextEdit);
      } else {
        const sortedItems = [...pageState.textItems].sort((a, b) => {
          const yDiff = b.transform[5] - a.transform[5];
          if (Math.abs(yDiff) > 2) {
            return yDiff;
          }
          return a.transform[4] - b.transform[4];
        });

        let outputText = '';
        if (sortedItems.length > 0) {
          outputText = sortedItems[0].str;
          for (let i = 1; i < sortedItems.length; i++) {
            const prev = sortedItems[i-1];
            const curr = sortedItems[i];
            const yDiff = prev.transform[5] - curr.transform[5];
            
            if (yDiff > prev.height * 1.5) {
              outputText += '\n\n' + curr.str;
            } 
            else if (yDiff > prev.height * 0.2) {
              outputText += '\n' + curr.str;
            }
            else {
              outputText += ' ' + curr.str;
            }
          }
        }
        setFormText(outputText);
      }
    }
  }, [mode, pageState.textItems, pageState.formTextEdit]);
  
  const handleTextChange = (id: string, value: string) => {
    setEdits(prev => ({ ...prev, [id]: value }));
  };
  
  const handleSave = () => {
    if (mode === 'form') {
        onSave(pageNumber - 1, {}, formText);
    } else {
        onSave(pageNumber - 1, edits);
    }
  };

  const resumableHandleAiEdit = async (currentFormText: string, currentAiPrompt: string) => {
    if (!currentAiPrompt.trim() || !currentFormText.trim()) return;
    setIsAiLoading(true);
    setAiError('');
    try {
        const modifiedText = await editPageTextWithAI(currentFormText, currentAiPrompt);
        setFormText(modifiedText);
    } catch (err: any) {
        if (err instanceof ApiLimitError) {
            setInterruptedTask({
                serviceId: 'edit',
                resume: (context) => resumableHandleAiEdit(context.formText, context.aiPrompt),
                context: { file, editingPageIndex: pageNumber - 1, formText: currentFormText, aiPrompt: currentAiPrompt }
            });
            onClose(); // Close the modal as the interruption modal will show up
        } else {
            setAiError(err.message || 'حدث خطأ من الذكاء الاصطناعي.');
        }
    } finally {
        setIsAiLoading(false);
    }
  };

  const handleAiEdit = async () => {
      resumableHandleAiEdit(formText, aiPrompt);
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog" aria-labelledby="edit-page-modal-title">
      <div ref={modalRef} className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
        <header className="flex justify-between items-center p-4 border-b dark:border-slate-600">
          <h2 id="edit-page-modal-title" className="text-xl font-bold text-slate-800 dark:text-slate-100">تعديل نصوص صفحة {pageNumber}</h2>
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700" aria-label="إغلاق">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 bg-slate-100 dark:bg-slate-900">
          {mode === 'visual' ? (
            <div className="relative w-full mx-auto" style={{ direction: 'ltr', maxWidth: pdfPage.getViewport({ scale: scale }).width }}>
              <canvas ref={canvasRef}></canvas>
              {pageState.textItems.map(item => {
                const isEditing = activeEditId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`absolute border border-transparent hover:border-blue-500 cursor-pointer ${isEditing ? 'z-20' : 'z-10'}`}
                    style={{
                      left: `${item.transform[4] * scale}px`,
                      top: `${(pdfPage.view[3] - item.transform[5]) * scale}px`,
                      width: `${item.width * scale}px`,
                      height: `${item.height * scale}px`,
                      transform: 'translateY(-100%)', // Adjust for PDF coordinate system
                    }}
                    onClick={() => setActiveEditId(item.id)}
                    onDoubleClick={() => setActiveEditId(item.id)}
                  >
                    {isEditing ? (
                      <textarea
                        value={edits[item.id] || item.str}
                        onChange={(e) => handleTextChange(item.id, e.target.value)}
                        onBlur={() => setActiveEditId(null)}
                        autoFocus
                        className="w-full h-full p-0 m-0 border-2 border-blue-600 bg-white/90 resize-none overflow-hidden"
                        style={{ fontSize: `${item.height * scale * 0.8}px`, direction: item.dir as 'ltr' | 'rtl' }}
                        aria-label={`تعديل النص: ${item.str}`}
                      />
                    ) : (
                      <div className="w-full h-full bg-blue-500/10"></div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 bg-white dark:bg-slate-800 rounded-md h-full flex flex-col gap-4">
                <div>
                    <label htmlFor="form-text-area" className="text-lg font-semibold text-slate-800 dark:text-slate-100">محتوى الصفحة</label>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        عدّل النص أدناه مباشرة، أو اطلب من الذكاء الاصطناعي إجراء تعديلات نيابة عنك.
                    </p>
                    <textarea
                        id="form-text-area"
                        value={formText}
                        onChange={(e) => setFormText(e.target.value)}
                        className="w-full h-80 p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans leading-relaxed bg-white dark:bg-slate-700"
                        style={{ direction: 'rtl', resize: 'vertical' }}
                    />
                </div>
                <div className="border-t dark:border-slate-700 pt-4">
                    <label htmlFor="ai-prompt-input" className="text-lg font-semibold text-slate-800 dark:text-slate-100">مساعد الذكاء الاصطناعي</label>
                     <div className="flex items-center gap-2 mt-2">
                        <input
                            id="ai-prompt-input"
                            type="text"
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            placeholder="مثال: صحح الأخطاء الإملائية، أو أعد صياغة الفقرة الأولى"
                            className="flex-grow w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700"
                        />
                        <button
                            onClick={handleAiEdit}
                            disabled={isAiLoading || !aiPrompt}
                            className="bg-sky-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-sky-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
                        >
                            {isAiLoading ? <Spinner /> : 'اطلب'}
                        </button>
                    </div>
                     {aiError && <p role="alert" className="mt-2 text-red-500 text-sm">{aiError}</p>}
                </div>
            </div>
          )}
        </main>
        
        <footer className="p-4 border-t bg-white dark:bg-slate-800 flex justify-end">
            <button
                onClick={handleSave}
                className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors"
            >
                حفظ وإغلاق
            </button>
        </footer>
      </div>
    </div>
  );
};

export default EditPageModal;
