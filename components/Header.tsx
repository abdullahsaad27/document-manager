
import React from 'react';

interface HeaderProps {
    title?: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
  return (
    <header className="bg-white dark:bg-slate-800 shadow-md sticky top-0 z-40">
      <div className="container mx-auto px-4 py-4">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          {title || 'مدير المستندات'}
        </h1>
      </div>
    </header>
  );
};

export default Header;