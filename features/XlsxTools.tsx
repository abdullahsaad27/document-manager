import React, { useState, useRef, useEffect } from 'react';
import Spinner from '../components/Spinner';
import FileUpload from '../components/FileUpload';
import ResultView from '../components/ResultView';
import SheetViewer from '../components/SheetViewer';
import { Service, ChatMessage } from '../types';
import { getExcelAnalysis, explainFormula } from '../services/aiService';
import { ApiLimitError } from '../services/aiService';
import { useAppContext } from '../AppContext';

declare const XLSX: any;
declare const html2canvas: any;
declare const PDFLib: any;
declare const Chart: any;

interface XlsxToolsProps {
  onSelectService: (service: Service) => void;
}

const XlsxTools: React.FC<XlsxToolsProps> = ({ onSelectService }) => {
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<any>(null);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultFile, setResultFile] = useState<File | null>(null);
  const sheetViewerRef = useRef<HTMLDivElement>(null);

  // AI Analyst state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // Formula explainer state
  const [explainingFormula, setExplainingFormula] = useState<string | null>(null);
  const [formulaExplanation, setFormulaExplanation] = useState('');
  const [isExplainLoading, setIsExplainLoading] = useState(false);

  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<any>(null);

  const { setInterruptedTask } = useAppContext();

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'assistant' && lastMessage.chart && chartCanvasRef.current) {
        if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
        }
        const ctx = chartCanvasRef.current.getContext('2d');
        if (ctx) {
            chartInstanceRef.current = new Chart(ctx, lastMessage.chart);
        }
    }
  }, [messages]);


  const handleFileSelect = (files: File[]) => {
    const selectedFile = files[0];
    if (selectedFile) {
      const acceptedTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      if (acceptedTypes.includes(selectedFile.type)) {
        setFile(selectedFile);
        setError('');
        setResultFile(null);
        setActiveSheetIndex(0);
        setMessages([]);
        setUserInput('');
        processWorkbook(selectedFile);
      } else {
        setError('الرجاء اختيار ملف Excel (XLSX, XLS) فقط.');
      }
    }
  };
  
  const processWorkbook = (fileToProcess: File) => {
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const wb = XLSX.read(data, { type: 'array' });
            setWorkbook(wb);
        } catch (err) {
            setError("فشل في قراءة ملف Excel. قد يكون الملف تالفًا.");
        } finally {
            setIsLoading(false);
        }
    };
    reader.onerror = () => {
        setError("فشل في قراءة الملف.");
        setIsLoading(false);
    }
    reader.readAsArrayBuffer(fileToProcess);
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || !workbook) return;

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userInput }];
    setMessages(newMessages);
    setUserInput('');
    setIsAiLoading(true);

    try {
        const activeSheet = workbook.Sheets[workbook.SheetNames[activeSheetIndex]];
        const csvData = XLSX.utils.sheet_to_csv(activeSheet);
        
        const result = await getExcelAnalysis(csvData, userInput);
        
        let assistantMessage: ChatMessage;
        try {
            // Check if the response is a valid JSON for a chart
            const chartConfig = JSON.parse(result);
            if (chartConfig.type && chartConfig.data) {
                assistantMessage = { role: 'assistant', content: 'لقد قمت بإنشاء الرسم البياني الذي طلبته.', chart: chartConfig };
            } else {
                 assistantMessage = { role: 'assistant', content: result };
            }
        } catch (e) {
            assistantMessage = { role: 'assistant', content: result };
        }
        
        setMessages([...newMessages, assistantMessage]);

    } catch (err: any) {
        const errorMessage = (err instanceof ApiLimitError)
            ? "تم الوصول إلى حد الاستخدام. يرجى التحقق من إعداداتك."
            : "حدث خطأ أثناء تحليل البيانات.";
        setMessages([...newMessages, { role: 'assistant', content: errorMessage }]);
        if (err instanceof ApiLimitError) {
             setInterruptedTask({
                serviceId: 'excel-tools',
                resume: handleSendMessage, 
                context: {}
            });
        }
    } finally {
        setIsAiLoading(false);
    }
  };
  
  const handleFormulaClick = async (formula: string) => {
    setExplainingFormula(formula);
    setIsExplainLoading(true);
    setFormulaExplanation('');
    try {
        const explanation = await explainFormula(formula);
        setFormulaExplanation(explanation);
    } catch(err) {
        setFormulaExplanation("فشل في شرح الصيغة.");
    } finally {
        setIsExplainLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setWorkbook(null);
    setResultFile(null);
    setError('');
    setActiveSheetIndex(0);
  };

  return (
    <div className="max-w-7xl mx-auto">
      {!workbook ? (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg max-w-3xl mx-auto">
            <div className="flex flex-col items-center">
                <FileUpload
                    onFileSelect={handleFileSelect}
                    acceptedFileTypes=".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    promptText="اسحب وأفلت ملف Excel (XLSX) هنا أو انقر للاختيار"
                />
                {isLoading && <div className="mt-4"><Spinner /></div>}
            </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate">{file?.name}</h3>
                    <div role="tablist" aria-label="أوراق العمل" className="bg-slate-100 dark:bg-slate-700 p-1 rounded-lg flex gap-1 flex-wrap">
                        {workbook.SheetNames.map((name: string, index: number) => (
                            <button 
                                key={name} 
                                onClick={() => setActiveSheetIndex(index)} 
                                role="tab"
                                aria-selected={activeSheetIndex === index}
                                aria-controls="sheet-panel"
                                className={`px-3 py-1 text-sm font-semibold rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${activeSheetIndex === index ? 'bg-white dark:bg-slate-600 shadow' : 'hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                                {name}
                            </button>
                        ))}
                    </div>
                </div>
                <div role="tabpanel" id="sheet-panel">
                    <SheetViewer 
                        sheet={workbook.Sheets[workbook.SheetNames[activeSheetIndex]]} 
                        onFormulaClick={handleFormulaClick}
                    />
                </div>
            </div>
            <div className="lg:col-span-1 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg flex flex-col h-[80vh]">
                 <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4 border-b dark:border-slate-700 pb-2">محلل البيانات AI</h3>
                 <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`max-w-xs lg:max-w-sm p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-700'}`}>
                                <p className="text-sm">{msg.content}</p>
                                {msg.chart && (
                                    <div className="mt-2 bg-white p-2 rounded">
                                        <canvas ref={chartCanvasRef} width="400" height="300"></canvas>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {isAiLoading && <div className="flex justify-start"><div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-700"><Spinner/></div></div>}
                 </div>
                 <div className="mt-4 pt-4 border-t dark:border-slate-700">
                    <div className="flex items-center gap-2">
                        <input 
                            type="text"
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder="اسأل عن بياناتك..."
                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700"
                        />
                        <button id="primary-action-button" onClick={handleSendMessage} disabled={isAiLoading || !userInput} className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 disabled:bg-slate-400">
                           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                        </button>
                    </div>
                 </div>
            </div>
        </div>
      )}
       {error && <p role="alert" className="mt-4 text-red-500 bg-red-100 dark:bg-red-900/50 dark:text-red-300 p-3 rounded-md w-full text-center">{error}</p>}

       {explainingFormula && (
         <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={() => setExplainingFormula(null)}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">شرح الصيغة</h3>
                <p className="font-mono text-sm p-2 bg-slate-100 dark:bg-slate-700 rounded mb-4 text-left" dir="ltr">{explainingFormula}</p>
                {isExplainLoading ? <Spinner /> : <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{formulaExplanation}</p>}
                <button onClick={() => setExplainingFormula(null)} className="mt-4 w-full bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-slate-100 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">إغلاق</button>
            </div>
         </div>
       )}
    </div>
  );
};

export default XlsxTools;