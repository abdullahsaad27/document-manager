import React, { useState, useEffect } from 'react';
import type { Service } from '../types';
import { PDF_SERVICES } from '../constants';
import ServiceCard from '../components/ServiceCard';
import { useAppContext } from '../AppContext';

// Import all PDF sub-feature components
import MergePdf from './MergePdf';
import SplitPdf from './SplitPdf';
import CompressPdf from './CompressPdf';
import ProtectPdf from './EncryptPdf';
import ImageToPdf from './ImageToPdf';
import PdfToImage from './PdfToImage';
import EditPdf from './EditPdf';
import WordToPdf from './WordToPdf';
import PdfToWord from './PdfToWord';
import SignPdf from './SignPdf';
import ExtractTextPdf from './ExtractTextPdf';


interface PdfToolsProps {
  onSelectService: (service: Service) => void;
}

const PdfTools: React.FC<PdfToolsProps> = (props) => {
    const [selectedSubService, setSelectedSubService] = useState<Service | null>(null);
    const { stagedFile, setStagedFile } = useAppContext();

    // When a staged file exists (from a "Next Step" action), find the corresponding service and select it.
    useEffect(() => {
        if (stagedFile?.context?.nextServiceId) {
            const nextService = PDF_SERVICES.find(s => s.id === stagedFile.context.nextServiceId);
            if (nextService) {
                // We don't clear the context here; the sub-component will receive the stagedFile
                // and should clear it after use.
                setSelectedSubService(nextService);
            }
        }
    }, [stagedFile]);


    const handleSelectSubService = (service: Service) => {
        setSelectedSubService(service);
    };

    const handleBackToPdfTools = () => {
        setSelectedSubService(null);
        setStagedFile(null); // Clear any staged file when going back to the hub
    };

    // This function is passed down to sub-components.
    // It handles navigation for the "Next Steps" feature in ResultView.
    const handleSubServiceNavigation = (service: Service) => {
        // Check if the target service is another PDF tool
        if (PDF_SERVICES.find(s => s.id === service.id)) {
            // If so, just switch the view within this hub component.
            // We add context to the staged file so the useEffect can pick it up.
            setStagedFile(prev => {
                if (!prev) return null;
                const newFile = new File([prev], prev.name, { type: prev.type, lastModified: prev.lastModified });
                return Object.assign(newFile, { context: { nextServiceId: service.id } });
            });
        } else {
            // Otherwise, it's a main-level service (like Library), so we call the original prop from App.tsx.
            props.onSelectService(service);
        }
    };


    if (!selectedSubService) {
        return (
            <div>
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold text-slate-800 dark:text-slate-100 mb-4">أدوات PDF</h1>
                    <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
                        مجموعة شاملة من الأدوات لتعديل، تحويل، وتنظيم ملفات PDF الخاصة بك.
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 items-stretch">
                    {PDF_SERVICES.map((service) => (
                        <ServiceCard key={service.id} service={service} onClick={handleSelectSubService} />
                    ))}
                </div>
            </div>
        );
    }

    const renderSubService = () => {
        switch (selectedSubService.id) {
            case 'merge': return <MergePdf onSelectService={handleSubServiceNavigation} />;
            case 'split': return <SplitPdf onSelectService={handleSubServiceNavigation} />;
            case 'compress': return <CompressPdf onSelectService={handleSubServiceNavigation} />;
            case 'protect': return <ProtectPdf onSelectService={handleSubServiceNavigation} />;
            case 'image-to-pdf': return <ImageToPdf onSelectService={handleSubServiceNavigation} />;
            case 'pdf-to-image': return <PdfToImage onSelectService={handleSubServiceNavigation} />;
            case 'edit': return <EditPdf />; // EditPdf doesn't have onSelectService prop
            case 'word-to-pdf': return <WordToPdf onSelectService={handleSubServiceNavigation} />;
            case 'pdf-to-word': return <PdfToWord onSelectService={handleSubServiceNavigation} />;
            case 'sign-pdf': return <SignPdf onSelectService={handleSubServiceNavigation} />;
            case 'extract-text-from-pdf': return <ExtractTextPdf onSelectService={handleSubServiceNavigation} />;
            default: return <p>الأداة غير موجودة.</p>;
        }
    }

    return (
        <div>
            <button
                onClick={handleBackToPdfTools}
                className="mb-6 flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors font-semibold"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transform scale-x-[-1]" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                <span>العودة إلى أدوات PDF</span>
            </button>
            <h2 className="text-3xl font-bold mb-8 text-center text-slate-800 dark:text-slate-100">{selectedSubService.title}</h2>
            {renderSubService()}
        </div>
    );
};

export default PdfTools;
