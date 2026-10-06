import React from 'react';

export const DevelopedBy: React.FC<{ className?: string }> = ({ className = '' }) => (
  <footer className={`no-print flex items-center justify-center gap-2 py-5 text-sm text-slate-600 ${className}`}>
    <span>Developed by</span>
    <span className="font-display text-lg font-bold tracking-tight text-brand-700 leading-none">
      Pace <span className="text-brand-500">IT</span>
    </span>
  </footer>
);
