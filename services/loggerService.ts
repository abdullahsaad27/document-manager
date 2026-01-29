// Browser-compatible simple event emitter implementation
type Listener = (data: any) => void;

export type LogType = 'info' | 'success' | 'error' | 'warning';

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: LogType;
  details?: string;
}

class LoggerService {
  private logs: LogEntry[] = [];
  private maxLogs: number = 100;
  private listeners: { [key: string]: Listener[] } = {};

  constructor() {
    this.listeners = {};
  }

  on(event: string, listener: Listener) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  off(event: string, listener: Listener) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(l => l !== listener);
  }

  emit(event: string, data?: any) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(listener => listener(data));
  }

  private addLog(message: string, type: LogType, details?: string) {
    const newLog: LogEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      message,
      type,
      details
    };

    this.logs.unshift(newLog); // Add to beginning
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    this.emit('log', newLog);
    
    // Also log to console for debugging
    const consoleMsg = `[${newLog.timestamp.toLocaleTimeString()}] ${message}`;
    if (type === 'error') console.error(consoleMsg, details);
    else if (type === 'warning') console.warn(consoleMsg, details);
    else console.log(consoleMsg, details || '');
  }

  info(message: string, details?: string) {
    this.addLog(message, 'info', details);
  }

  success(message: string, details?: string) {
    this.addLog(message, 'success', details);
  }

  error(message: string, details?: any) {
    const detailStr = details instanceof Error ? details.message : (typeof details === 'object' ? JSON.stringify(details) : details);
    this.addLog(message, 'error', detailStr);
  }

  warning(message: string, details?: string) {
    this.addLog(message, 'warning', details);
  }

  getLogs() {
    return this.logs;
  }

  clear() {
    this.logs = [];
    this.emit('clear');
  }
}

export const logger = new LoggerService();
