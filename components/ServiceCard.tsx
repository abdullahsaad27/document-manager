import React from 'react';
import type { Service } from '../types';

interface ServiceCardProps {
  service: Service;
  onClick: (service: Service) => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ service, onClick }) => {
  const shortcutMap: { [key: string]: string } = {
    library: 'Alt + L',
    settings: 'Alt + S',
  };
  const shortcut = shortcutMap[service.id];

  return (
    <button
      onClick={() => onClick(service)}
      className="relative bg-white dark:bg-slate-800 rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300 p-6 flex flex-col items-center text-center w-full h-full group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
      aria-labelledby={`service-title-${service.id}`}
      aria-describedby={`service-desc-${service.id}`}
    >
      {shortcut && <div className="absolute top-2 right-2 text-xs bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 font-mono px-1.5 py-0.5 rounded">{shortcut}</div>}
      <div className="bg-blue-100 text-blue-600 rounded-full p-4 mb-4 group-hover:bg-blue-200 transition-colors">
        {service.icon}
      </div>
      <h3 id={`service-title-${service.id}`} className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">{service.title}</h3>
      <p id={`service-desc-${service.id}`} className="text-slate-500 dark:text-slate-400 flex-grow">{service.description}</p>
      {!service.implemented && (
         <span className="mt-4 text-xs bg-amber-200 text-amber-800 font-semibold px-2 py-1 rounded-full">قريباً</span>
      )}
    </button>
  );
};

export default ServiceCard;