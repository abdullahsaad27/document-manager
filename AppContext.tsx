import React, { createContext, useState, useContext, ReactNode } from 'react';
// FIX: Import StagedFile from the central types file.
import type { StagedFile } from './types';

export interface InterruptedTask {
  serviceId: string;
  resume: (context?: any) => Promise<void> | void;
  context?: any;
}

interface AppContextType {
  interruptedTask: InterruptedTask | null;
  setInterruptedTask: (task: InterruptedTask | null) => void;
  clearInterruptedTask: () => void;
  stagedFile: StagedFile | null;
  setStagedFile: React.Dispatch<React.SetStateAction<StagedFile | null>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [interruptedTask, setInterruptedTask] = useState<InterruptedTask | null>(null);
  const [stagedFile, setStagedFile] = useState<StagedFile | null>(null);

  const clearInterruptedTask = () => {
    setInterruptedTask(null);
  };

  const value = {
    interruptedTask,
    setInterruptedTask,
    clearInterruptedTask,
    stagedFile,
    setStagedFile,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
