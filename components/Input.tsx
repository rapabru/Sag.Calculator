
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
  unit?: string;
}

export const Input: React.FC<InputProps> = ({ label, id, unit, ...props }) => {
  return (
    <div className="h-full bg-white dark:bg-slate-600 p-3 rounded-lg shadow-md border border-slate-200 dark:border-slate-500 space-y-3">
      <label htmlFor={id} className="block text-base font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className="focus:ring-sky-500 focus:border-sky-500 block w-full text-base border-slate-300 dark:border-slate-500 rounded-md py-3 ps-4 pe-10 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
          {...props}
        />
        {unit && (
          <div className="absolute inset-y-0 end-0 pe-3 flex items-center pointer-events-none">
            <span className="text-slate-500 dark:text-slate-400 text-base">{unit}</span>
          </div>
        )}
      </div>
    </div>
  );
};