import React from 'react';
import { SHIRT_SIZES, SHIRT_TYPES, SHIRT_TYPE_LABEL, MAX_GROUP_SIZE, emptyRow, normalizeShirtType } from '../../utils/participants';

// Editable list of group members. On a laptop it's a table; on a phone each member becomes a
// stacked card. `errors` = { [rowIndex]: { name?, email?, shirt_type?, shirt_size? } }.
// Shirt type is the shirt's cut (male / female), chosen freely, not the runner's gender.
export default function MemberTable({ rows, setRows, errors = {}, showErrors }) {
  const update = (i, field, value) => {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, [field]: value } : r)));
  };
  const remove = (i) => setRows((prev) => prev.filter((_, j) => j !== i));
  const addRows = (n) =>
    setRows((prev) => [...prev, ...Array.from({ length: Math.min(n, MAX_GROUP_SIZE - prev.length) }, emptyRow)]);

  const inputClass = (bad) =>
    `w-full px-3 py-2 border-2 rounded-lg focus:outline-none transition ${
      bad ? 'border-red-400 bg-red-50 focus:border-red-500' : 'border-slate-200 focus:border-orange-500'
    }`;

  return (
    <div>
      {/* Column headings (laptop only) */}
      <div className="hidden sm:grid grid-cols-[2.5rem_1fr_1fr_7rem_6rem_2.5rem] gap-2 px-1 pb-2 text-xs font-bold text-slate-500 uppercase tracking-wide">
        <span>#</span>
        <span>Full name (as on certificate) *</span>
        <span>Email (optional)</span>
        <span>Shirt type *</span>
        <span>Size *</span>
        <span />
      </div>

      <div className="space-y-2">
        {rows.map((r, i) => {
          const e = showErrors ? errors[i] || {} : {};
          const sizeIsUnknown = r.shirt_size && !SHIRT_SIZES.includes(r.shirt_size.trim().toUpperCase());
          const typeValue = normalizeShirtType(r.shirt_type) || (r.shirt_type || '').trim();
          const typeIsUnknown = typeValue && !SHIRT_TYPES.includes(typeValue);
          return (
            <div
              key={i}
              className={`rounded-lg p-2 sm:p-1 border sm:border-0 ${
                Object.keys(e).length ? 'border-red-300 bg-red-50/40' : 'border-slate-200'
              }`}
            >
              <div className="grid grid-cols-[2.5rem_1fr_1fr_2.5rem] sm:grid-cols-[2.5rem_1fr_1fr_7rem_6rem_2.5rem] gap-2 items-start">
                <span className="pt-2 text-sm font-bold text-slate-500">{i + 1}</span>

                <input
                  aria-label={`Row ${i + 1} full name`}
                  value={r.name}
                  onChange={(ev) => update(i, 'name', ev.target.value)}
                  placeholder="Full name (as on certificate)"
                  className={`${inputClass(e.name)} col-span-2 sm:col-span-1`}
                />

                {/* Remove button sits next to the name on phones */}
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`Remove row ${i + 1}`}
                  className="sm:hidden h-10 text-slate-400 hover:text-red-600 font-bold text-xl"
                >
                  ×
                </button>

                <input
                  aria-label={`Row ${i + 1} email`}
                  type="email"
                  value={r.email}
                  onChange={(ev) => update(i, 'email', ev.target.value)}
                  placeholder="Email (optional)"
                  className={`${inputClass(e.email)} col-start-2 col-span-2 sm:col-start-auto sm:col-span-1`}
                />

                <select
                  aria-label={`Row ${i + 1} shirt type`}
                  value={typeValue}
                  onChange={(ev) => update(i, 'shirt_type', ev.target.value)}
                  className={`${inputClass(e.shirt_type)} col-start-2 sm:col-start-auto bg-white`}
                >
                  <option value="">Type…</option>
                  {typeIsUnknown && <option value={typeValue}>{typeValue} (invalid)</option>}
                  {SHIRT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {SHIRT_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>

                <select
                  aria-label={`Row ${i + 1} shirt size`}
                  value={sizeIsUnknown ? r.shirt_size : r.shirt_size.trim().toUpperCase()}
                  onChange={(ev) => update(i, 'shirt_size', ev.target.value)}
                  className={`${inputClass(e.shirt_size)} sm:col-start-auto bg-white`}
                >
                  <option value="">Size…</option>
                  {sizeIsUnknown && <option value={r.shirt_size}>{r.shirt_size} (invalid)</option>}
                  {SHIRT_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`Remove row ${i + 1}`}
                  className="hidden sm:block h-10 text-slate-400 hover:text-red-600 font-bold text-xl"
                >
                  ×
                </button>
              </div>

              {Object.values(e).length > 0 && (
                <ul className="mt-1 ml-[3rem] text-sm text-red-600 font-semibold">
                  {Object.values(e).map((msg) => (
                    <li key={msg}>{msg}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 mt-4">
        <button
          type="button"
          onClick={() => addRows(1)}
          disabled={rows.length >= MAX_GROUP_SIZE}
          className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2 px-4 rounded-lg transition disabled:opacity-50"
        >
          + Add member
        </button>
        <button
          type="button"
          onClick={() => addRows(10)}
          disabled={rows.length >= MAX_GROUP_SIZE}
          className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2 px-4 rounded-lg transition disabled:opacity-50"
        >
          + Add 10 rows
        </button>
      </div>
    </div>
  );
}
