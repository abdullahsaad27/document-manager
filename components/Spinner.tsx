
import React from 'react';

const Spinner: React.FC = () => {
  return (
    <div role="status" className="flex items-center justify-center">
      <div className="border-4 border-slate-200 border-t-blue-500 rounded-full w-8 h-8 animate-spin"></div>
      <span className="sr-only">جاري التحميل...</span>
    </div>
  );
};

export default Spinner;