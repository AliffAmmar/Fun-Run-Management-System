import React from 'react';
import { SHIRT_SIZES, SHIRT_TYPES, SHIRT_TYPE_LABEL } from '../../utils/participants';

// Shirt counts, always derived from the runners (never typed in separately).
//   counts:    totals per size  { XS: 0, S: 3, ... }
//   breakdown: per shirt type   { male: { S: 2, ... }, female: { S: 1, ... } }   (optional)
// With a breakdown it shows a Male / Female / Total table (what kit preparation needs).
export default function ShirtSizeSummary({ counts = {}, breakdown }) {
  const typed = breakdown && SHIRT_TYPES.some((t) => SHIRT_SIZES.some((s) => breakdown[t]?.[s]));
  if (!typed) {
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

  const cell = 'py-2 text-center tabular-nums';
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[18rem] text-sm bg-white border-2 border-slate-200 rounded-lg">
        <thead>
          <tr className="text-xs font-bold text-slate-500">
            <th className="py-2 px-2 text-left font-bold">Cut</th>
            {SHIRT_SIZES.map((s) => (
              <th key={s} className={cell}>
                {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SHIRT_TYPES.map((t) => (
            <tr key={t} className="border-t border-slate-100">
              <th scope="row" className="py-2 px-2 text-left font-bold text-slate-700">
                {SHIRT_TYPE_LABEL[t]}
              </th>
              {SHIRT_SIZES.map((s) => (
                <td key={s} className={`${cell} font-black ${breakdown[t]?.[s] ? 'text-slate-900' : 'text-slate-300'}`}>
                  {breakdown[t]?.[s] || 0}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t-2 border-slate-200 bg-slate-50">
            <th scope="row" className="py-2 px-2 text-left font-bold text-slate-500">
              Total
            </th>
            {SHIRT_SIZES.map((s) => (
              <td key={s} className={`${cell} font-bold text-slate-600`}>
                {counts[s] || 0}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
