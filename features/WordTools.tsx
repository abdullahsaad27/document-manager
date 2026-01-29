
import React, { useState, useEffect } from 'react';
import type { Service } from '../types';
import { WORD_SERVICES } from '../constants';
import ServiceCard from '../components/ServiceCard';
import { useAppContext } from '../AppContext';

// Import Word sub-feature components
import WordToPdf from './WordToPdf';
import PdfToWord from './PdfToWord';
import WordAssistant from './WordAssistant';

interface WordToolsProps {
  onSelectService: (service: Service) => void;
}

const WordTools: React.FC<WordToolsProps> = (props) => {
    const [selectedSubService, setSelectedSubService] = useState<Service | null>(null);
    const { stagedFile, setStagedFile } = useAppContext();

    // When a staged file exists, find the corresponding service and select it.
    useEffect(() => {
        if (stagedFile?.context?.nextServiceId) {
            const nextService = WORD_SERVICES.find(s => s.id === stagedFile.context.nextServiceId);
            if (nextService) {
                setSelectedSubService(nextService);
            }
        }
    }, [stagedFile]);

    const handleSelectSubService = (service: Service) => {
        setSelectedSubService(service);
    };

    const handleBackToWordTools = () => {
        setSelectedSubService(null);
        setStagedFile(null); 
    };

    // Navigation handler for internal routing or external
    const handleSubServiceNavigation = (service: Service) => {
        if (WORD_SERVICES.find(s => s.id === service.id)) {
            setStagedFile(prev => {
                if (!prev) return null;
                const newFile = new File([prev], prev.name, { type: prev.type, lastModified: prev.lastModified });
                return Object.assign(newFile, { context: { nextServiceId: service.id } });
            });
        } else {
            props.onSelectService(service);
        }
    };

    if (!selectedSubService) {
        return (
            <div>
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold text-slate-800 dark:text-slate-100 mb-4">أدوات Word</h1>
                    <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
                        حرر، حول، ودردش مع مستنداتك النصية باستخدام أحدث تقنيات الذكاء الاصطناعي.
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch max-w-5xl mx-auto">
                    {WORD_SERVICES.map((service) => (
                        <ServiceCard key={service.id} service={service} onClick={handleSelectSubService} />
                    ))}
                </div>
            </div>
        );
    }

    const renderSubService = () => {
        switch (selectedSubService.id) {
            case 'word-to-pdf': return <WordToPdf onSelectService={handleSubServiceNavigation} />;
            case 'pdf-to-word': return <PdfToWord onSelectService={handleSubServiceNavigation} />;
            case 'word-assistant': return <WordAssistant />;
            default: return <p>الأداة غير موجودة.</p>;
        }
    }

    return (
        <div>
            <button
                onClick={handleBackToWordTools}
                className="mb-6 flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors font-semibold"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transform scale-x-[-1]" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                <span>العودة إلى أدوات Word</span>
            </button>
            <h2 className="text-3xl font-bold mb-8 text-center text-slate-800 dark:text-slate-100">{selectedSubService.title}</h2>
            {renderSubService()}
        </div>
    );
};

export default WordTools;
