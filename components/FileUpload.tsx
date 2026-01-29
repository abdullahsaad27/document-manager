import React, { useState, useCallback, useRef } from 'react';

interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  acceptedFileTypes: string;
  multiple?: boolean;
  promptText: string;
  promptSubText?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, acceptedFileTypes, multiple = false, promptText, promptSubText }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      onFileSelect(droppedFiles);
      e.dataTransfer.clearData();
    }
  }, [onFileSelect]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(Array.from(e.target.files));
    }
     // Reset the input value to allow selecting the same file again
    e.target.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
      }
  };

  return (
    <div className="w-full">
      <label
        id="file-upload-label"
        htmlFor="file-upload"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`${promptText}. اضغط Enter لاختيار الملفات`}
        className={`w-full cursor-pointer bg-slate-100 dark:bg-slate-800/50 border-2 border-dashed rounded-lg p-10 text-center transition-all ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700'} focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-slate-400 dark:text-slate-500 mb-2">
          <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
          <path d="M12 12v9" />
          <path d="m16 16-4-4-4 4" />
        </svg>
        <span className="text-slate-600 dark:text-slate-300 font-semibold select-none">{promptText}</span>
        {promptSubText && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 select-none">{promptSubText}</p>}
      </label>
      <input
        ref={inputRef}
        id="file-upload"
        type="file"
        accept={acceptedFileTypes}
        className="hidden"
        onChange={handleFileChange}
        multiple={multiple}
        tabIndex={-1} 
      />
    </div>
  );
};

export default FileUpload;