
import React from 'react';

const PlaceholderFeature: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-lg text-center">
      <div className="flex flex-col items-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 mb-4"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v6l4 2"/></svg>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">قريباً!</h2>
        <p className="text-slate-600">نحن نعمل بجد على تطوير هذه الميزة. ترقبوا التحديثات القادمة.</p>
      </div>
    </div>
  );
};

export default PlaceholderFeature;
