import React, { useEffect, useState, useRef } from 'react';
import { logger, LogEntry } from '../services/loggerService';

const LogViewer: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLogs(logger.getLogs());

    const handleNewLog = (log: LogEntry) => {
      setLogs(prev => [log, ...prev]);
    };

    const handleClear = () => {
      setLogs([]);
    };

    logger.on('log', handleNewLog);
    logger.on('clear', handleClear);

    return () => {
      logger.off('log', handleNewLog);
      logger.off('clear', handleClear);
    };
  }, []);

  const toggleOpen = () => setIsOpen(!isOpen);

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'error': return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-200 border-red-200';
      case 'success': return 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-200 border-green-200';
      case 'warning': return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-200 border-amber-200';
      default: return 'text-slate-600 bg-slate-50 dark:bg-slate-800 dark:text-slate-300 border-slate-200';
    }
  };

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out ${isOpen ? 'h-64' : 'h-10'} bg-white dark:bg-slate-900 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] border-t border-slate-200 dark:border-slate-700`}>
      {/* Header / Toggle Bar */}
      <div 
        onClick={toggleOpen}
        className="h-10 px-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${logs.length > 0 && logs[0].type === 'error' ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></span>
          <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-200">سجل العمليات والتشخيص {logs.length > 0 && `(${logs.length})`}</h3>
        </div>
        <div className="flex items-center gap-2">
           <button 
            onClick={(e) => { e.stopPropagation(); logger.clear(); }}
            className="text-xs px-2 py-1 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded"
          >
            مسح السجل
          </button>
          <span className="text-slate-400 text-xs">{isOpen ? '▼ إخفاء' : '▲ إظهار'}</span>
        </div>
      </div>

      {/* Log Content */}
      {isOpen && (
        <div className="h-[calc(100%-2.5rem)] overflow-y-auto p-4 space-y-2 font-mono text-xs" dir="ltr">
          {logs.length === 0 ? (
            <p className="text-center text-slate-400 py-4 italic">لا توجد عمليات مسجلة بعد...</p>
          ) : (
            logs.map(log => (
              <div key={log.id} className={`p-2 rounded border-l-4 ${getTypeStyles(log.type)}`}>
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold">{log.timestamp.toLocaleTimeString()}</span>
                  <span className="uppercase text-[10px] opacity-75 px-1 rounded border border-current">{log.type}</span>
                </div>
                <div className="whitespace-pre-wrap">{log.message}</div>
                {log.details && (
                  <div className="mt-1 pt-1 border-t border-black/5 dark:border-white/5 opacity-80 overflow-x-auto">
                    {log.details}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      )}
    </div>
  );
};

export default LogViewer;
