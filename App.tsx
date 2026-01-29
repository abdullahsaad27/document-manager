
import React, { useState, Suspense, useCallback, useEffect } from 'react';
import Header from './components/Header';
import type { LibraryDocument, Service } from './types';
import BackButton from './components/BackButton';
import { SERVICES } from './constants';
import { useAppContext } from './AppContext';
import InterruptionModal from './components/InterruptionModal';
import Spinner from './components/Spinner';
import LogViewer from './components/LogViewer';

// Lazy load feature components
const Home = React.lazy(() => import('./features/Home'));
const SummarizeDoc = React.lazy(() => import('./features/SummarizeDoc'));
const PlaceholderFeature = React.lazy(() => import('./features/PlaceholderFeature'));
const OcrDoc = React.lazy(() => import('./features/OcrDoc'));
const ViewDoc = React.lazy(() => import('./features/ViewDoc'));
const CreateQuiz = React.lazy(() => import('./features/CreateQuiz'));
const CorrectText = React.lazy(() => import('./features/CorrectText'));
const Library = React.lazy(() => import('./features/Library'));
const Settings = React.lazy(() => import('./features/Settings'));
const PptxTools = React.lazy(() => import('./features/PptxTools'));
const XlsxTools = React.lazy(() => import('./features/XlsxTools'));
const PdfTools = React.lazy(() => import('./features/PdfTools'));
const WordTools = React.lazy(() => import('./features/WordTools'));
const LiveAssistant = React.lazy(() => import('./features/LiveAssistant'));


const App: React.FC = () => {
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [viewingDocument, setViewingDocument] = useState<LibraryDocument | null>(null);
    const { interruptedTask, clearInterruptedTask, setStagedFile } = useAppContext();

    const handleSelectService = useCallback((service: Service) => {
        setViewingDocument(null);
        setSelectedService(service);
    }, []);
    
    const handleViewDocument = (doc: LibraryDocument) => {
        setStagedFile(null); // Clear any staged file when viewing from library
        setViewingDocument(doc);
        const viewService = SERVICES.find(s => s.id === 'view');
        if (viewService) {
            setSelectedService(viewService);
        }
    };
    
    const handleBack = useCallback(() => {
        setSelectedService(null);
        setViewingDocument(null);
        setStagedFile(null); // Clear staged file on back
    }, []);

    const handleGoToSettings = useCallback(() => {
        const settingsService = SERVICES.find(s => s.id === 'settings');
        if (settingsService) {
            handleSelectService(settingsService);
        }
    }, [handleSelectService]);

    const handleSettingsSave = () => {
        if (interruptedTask?.resume) {
            console.log("Settings saved, resuming task...");
            interruptedTask.resume(interruptedTask.context);
        }
        handleBack(); 
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
            const isContentEditable = target.isContentEditable;
            const isModalOpen = document.querySelector('[role="dialog"]');

            // Allow Ctrl+Enter for submitting forms, but block most other shortcuts while typing
            if ((isTyping || isContentEditable) && !((e.metaKey || e.ctrlKey) && e.key === 'Enter')) {
                // But allow Escape to close modals or go back
                if (e.key !== 'Escape') {
                    return;
                }
            }
            
            // Don't trigger global shortcuts if a modal is open, except for Escape
            if (isModalOpen && e.key !== 'Escape') {
                return;
            }

            // Navigation shortcuts (Alt + key)
            if (e.altKey) {
                e.preventDefault();
                switch (e.key.toLowerCase()) {
                    case 'h': // Home
                        handleBack();
                        break;
                    case 'l': // Library
                        const libraryService = SERVICES.find(s => s.id === 'library');
                        if (libraryService) handleSelectService(libraryService);
                        break;
                    case 's': // Settings
                        handleGoToSettings();
                        break;
                }
                return; // Exit after handling Alt key to prevent other handlers
            }

            // Back action (Escape)
            if (e.key === 'Escape') {
                e.preventDefault();
                if (!isModalOpen) {
                    handleBack();
                }
                return;
            }

            // Action shortcuts (Ctrl/Cmd + key)
            if (e.metaKey || e.ctrlKey) {
                switch (e.key.toLowerCase()) {
                    case 'u': // Upload
                        e.preventDefault();
                        (document.getElementById('file-upload-label') as HTMLLabelElement)?.click();
                        break;
                    case 'enter': // Primary Action
                        e.preventDefault();
                        const primaryButton = document.getElementById('primary-action-button') as HTMLButtonElement;
                        if (primaryButton && !primaryButton.disabled) {
                            primaryButton.click();
                        }
                        break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleBack, handleSelectService, handleGoToSettings]);


    const currentServiceComponent = () => {
        if (viewingDocument) {
            return <ViewDoc document={viewingDocument} onNavigateToService={handleSelectService} />;
        }
        if (!selectedService) {
            return <Home onSelectService={handleSelectService} />;
        }
        if (!selectedService.implemented) {
            return <PlaceholderFeature />;
        }
        switch (selectedService.id) {
            case 'summarize': return <SummarizeDoc onSelectService={handleSelectService} />;
            case 'quiz': return <CreateQuiz />;
            case 'correct-text': return <CorrectText />;
            case 'pdf-tools': return <PdfTools onSelectService={handleSelectService} />;
            case 'ocr': return <OcrDoc onSelectService={handleSelectService} />;
            case 'view': return <ViewDoc onNavigateToService={handleSelectService} />;
            case 'library': return <Library onViewDocument={handleViewDocument} />;
            case 'settings': return <Settings onSave={handleSettingsSave} />;
            case 'ppt-tools': return <PptxTools onSelectService={handleSelectService} />;
            case 'excel-tools': return <XlsxTools onSelectService={handleSelectService} />;
            case 'word-tools': return <WordTools onSelectService={handleSelectService} />;
            case 'live-assistant': return <LiveAssistant />;
            default: return <PlaceholderFeature />;
        }
    };

    return (
        <div className="bg-slate-50 dark:bg-slate-900 min-h-screen" style={{ direction: 'rtl' }}>
            <Header title={selectedService?.title} />
            <main className="container mx-auto px-4 py-8">
                {selectedService && <BackButton onClick={handleBack} />}
                 <Suspense fallback={<div className="flex justify-center items-center py-20" aria-label="جاري تحميل الميزة..."><Spinner /></div>}>
                  {currentServiceComponent()}
                </Suspense>
            </main>
            <InterruptionModal
                isOpen={!!interruptedTask}
                title="تم الوصول إلى حد الاستخدام"
                message="يبدو أنك استنفدت حصتك. يمكنك تغيير مزود الخدمة أو المفتاح في الإعدادات، أو المحاولة لاحقًا."
                onConfirm={() => {
                    handleGoToSettings();
                }}
                onCancel={clearInterruptedTask}
                confirmText="الذهاب إلى الإعدادات"
                cancelText="إغلاق"
            />
            <LogViewer />
        </div>
    );
};

export default App;
