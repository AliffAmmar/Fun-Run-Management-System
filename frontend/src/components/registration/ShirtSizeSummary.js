import React from 'react';
import { SHIRT_SIZES } from '../../utils/participants';

// Shirt-size totals, always derived from the member rows (never typed in separately).
export default function ShirtSizeSummary({ counts }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {SHIRT_SIZES.map((s) => (
        <div key={s} className="bg-white border-2 border-slate-200 rounded-lg py-2 text-center">
          <p className="text-xs font-bold text-slate-500">{s}</p>
          <p className="text-xl font-black text-slate-900">{counts[s] || 0}</p>
        </div>
      ))}
    </div>
  );
}
