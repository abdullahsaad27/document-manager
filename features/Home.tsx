
import React from 'react';
import { SERVICES } from '../constants';
import ServiceCard from '../components/ServiceCard';
import type { Service } from '../types';

interface HomeProps {
  onSelectService: (service: Service) => void;
}

const Home: React.FC<HomeProps> = ({ onSelectService }) => {
  return (
    <div>
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-800 dark:text-slate-100 mb-4">أدواتك الشاملة لإدارة المستندات</h1>
        <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
          من الدمج والتقسيم إلى التحليل الذكي، كل ما تحتاجه للتعامل مع مستنداتك بكفاءة وسهولة.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 items-stretch">
        {SERVICES.map((service) => (
          <ServiceCard key={service.id} service={service} onClick={onSelectService} />
        ))}
      </div>
    </div>
  );
};

export default Home;