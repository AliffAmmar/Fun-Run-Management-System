import React from 'react';

// Same look as the Login page: gradient background, white card with a header.
export default function AuthCard({ title, subtitle, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-red-700 to-orange-600 px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 via-red-700 to-orange-600 p-8 text-white text-center">
          <h2 className="text-3xl font-black">{title}</h2>
          {subtitle && <p className="text-orange-100 mt-2">{subtitle}</p>}
        </div>
        <div className="p-8 space-y-6">{children}</div>
      </div>
    </div>
  );
}

export const inputClass =
  'w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 transition text-lg';
export const labelClass = 'block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide';
export const buttonClass =
  'w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-4 px-6 rounded-lg shadow-lg transition duration-300 disabled:opacity-50 text-lg uppercase tracking-wide';
