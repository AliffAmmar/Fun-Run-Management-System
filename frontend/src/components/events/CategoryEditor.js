import React, { useState } from 'react';

// Race categories for Create/Edit Event: each with a price and its OWN capacity (runners).
// The event's total capacity is the sum, shown underneath. Prices and capacities stay editable
// after adding. The server re-checks everything (and refuses to shrink a category below the
// runners already registered in it).
export const CATEGORY_OPTIONS = ['1km', '3km', '5km', '10km'];

export const totalCapacity = (categories) =>
  categories.reduce((sum, c) => sum + (parseInt(c.capacity, 10) > 0 ? parseInt(c.capacity, 10) : 0), 0);

// Returns an error message, or '' when every category has a valid price and capacity.
export function categoriesError(categories) {
  if (categories.length === 0) return 'Please add at least one category';
  for (const c of categories) {
    if (c.price === '' || !(parseFloat(c.price) >= 0)) return `Please enter a valid price for ${c.name}`;
    const cap = Number(c.capacity);
    if (!Number.isInteger(cap) || cap < 1) return `Please enter a capacity (at least 1) for ${c.name}`;
  }
  return '';
}

// For the API: numbers, not strings.
export const toApiCategories = (categories) =>
  categories.map((c) => ({ name: c.name, price: parseFloat(c.price), capacity: parseInt(c.capacity, 10) }));

const input =
  'w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 transition';

export default function CategoryEditor({ categories, onChange }) {
  const unused = CATEGORY_OPTIONS.filter((name) => !categories.some((c) => c.name === name));
  const [newName, setNewName] = useState(unused[0] || '');
  const [newPrice, setNewPrice] = useState('');
  const [newCapacity, setNewCapacity] = useState('');
  const [error, setError] = useState('');

  const add = () => {
    const name = unused.includes(newName) ? newName : unused[0];
    if (!name) return;
    const draft = { name, price: newPrice, capacity: newCapacity };
    const problem = categoriesError([draft]);
    if (problem) {
      setError(problem);
      return;
    }
    onChange(
      [...categories, draft].sort((a, b) => CATEGORY_OPTIONS.indexOf(a.name) - CATEGORY_OPTIONS.indexOf(b.name))
    );
    setNewName(unused.filter((u) => u !== name)[0] || '');
    setNewPrice('');
    setNewCapacity('');
    setError('');
  };

  const update = (idx, field, value) => onChange(categories.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  const remove = (idx) => onChange(categories.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4">
      {categories.length > 0 && (
        <div className="bg-white border-2 border-slate-200 rounded-xl p-4 sm:p-6 space-y-3">
          <div className="hidden sm:grid grid-cols-[5rem_1fr_1fr_2.5rem] gap-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
            <span>Category</span>
            <span>Price (RM)</span>
            <span>Capacity (runners)</span>
            <span />
          </div>
          {categories.map((c, idx) => (
            <div
              key={c.name}
              className="grid grid-cols-[5rem_1fr_2.5rem] sm:grid-cols-[5rem_1fr_1fr_2.5rem] gap-3 items-center bg-orange-50 border-2 border-orange-200 rounded-lg p-3"
            >
              <span className="font-black text-slate-900 text-lg">{c.name}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                aria-label={`${c.name} price`}
                value={c.price}
                onChange={(e) => update(idx, 'price', e.target.value)}
                className={input}
              />
              <button
                type="button"
                onClick={() => remove(idx)}
                aria-label={`Remove ${c.name}`}
                className="sm:order-last text-red-600 hover:text-red-800 font-bold text-lg"
              >
                ✕
              </button>
              <input
                type="number"
                min="1"
                step="1"
                aria-label={`${c.name} capacity`}
                placeholder="Runners"
                value={c.capacity}
                onChange={(e) => update(idx, 'capacity', e.target.value)}
                className={`${input} col-start-2 sm:col-start-auto`}
              />
            </div>
          ))}
          <p className="text-slate-700 font-semibold pt-1">
            Total capacity: <span className="font-black text-slate-900">{totalCapacity(categories)}</span> runners
          </p>
        </div>
      )}

      {unused.length > 0 && (
        <div className="bg-gradient-to-br from-slate-50 to-orange-50 p-4 sm:p-6 rounded-xl border-2 border-orange-200 space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="new-category" className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">
                Category
              </label>
              <select id="new-category" value={unused.includes(newName) ? newName : unused[0]} onChange={(e) => setNewName(e.target.value)} className={`${input} py-3 bg-white`}>
                {unused.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="new-price" className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">
                Price (RM)
              </label>
              <input id="new-price" type="number" min="0" step="0.01" placeholder="0.00" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} className={`${input} py-3`} />
            </div>
            <div>
              <label htmlFor="new-capacity" className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">
                Capacity
              </label>
              <input id="new-capacity" type="number" min="1" step="1" placeholder="Runners" value={newCapacity} onChange={(e) => setNewCapacity(e.target.value)} className={`${input} py-3`} />
            </div>
          </div>
          {error && <p className="text-red-600 font-semibold">{error}</p>}
          <button
            type="button"
            onClick={add}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-4 rounded-lg transition uppercase tracking-wide"
          >
            + Add category
          </button>
        </div>
      )}
    </div>
  );
}
