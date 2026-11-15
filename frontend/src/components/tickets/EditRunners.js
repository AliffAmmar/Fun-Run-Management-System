import React, { useState } from 'react';
import apiClient from '../../utils/apiClient';
import { SHIRT_SIZES } from '../../utils/participants';

// Buyer corrects runner names / shirt sizes after registering (until the kit preparation cutoff).
// Runners can't be added or removed. One row = one save.
export default function EditRunners({ order, onSaved, onClose }) {
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(order.participants.map((p) => [p._id, { name: p.name, shirt_size: p.shirt_size }]))
  );
  const [saving, setSaving] = useState(null);
  const [messages, setMessages] = useState({}); // participantId → { ok?, error? }

  const change = (id, field, value) => setDrafts((d) => ({ ...d, [id]: { ...d[id], [field]: value } }));

  const save = async (p) => {
    const draft = drafts[p._id];
    const body = {};
    if (draft.name.trim() !== p.name) body.name = draft.name;
    if (draft.shirt_size !== p.shirt_size) body.shirt_size = draft.shirt_size;
    if (Object.keys(body).length === 0) return;

    setSaving(p._id);
    setMessages((m) => ({ ...m, [p._id]: {} }));
    try {
      const res = await apiClient.patch(`/orders/${order.order_no}/participants/${p._id}`, body);
      setMessages((m) => ({ ...m, [p._id]: { ok: 'Saved' } }));
      onSaved(res.data.order);
    } catch (err) {
      setMessages((m) => ({ ...m, [p._id]: { error: err.response?.data?.message || 'Could not save' } }));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex justify-between items-start gap-3">
        <p className="text-sm text-slate-700">
          Fix spelling (names appear on certificates) or shirt sizes until{' '}
          <b>{new Date(order.edit_until).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' })}</b>.
          {order.kit_collected && ' Kits are already collected, so sizes are locked.'}
        </p>
        <button onClick={onClose} className="text-sm font-bold text-slate-500 hover:text-slate-800 shrink-0">
          Done
        </button>
      </div>
      <ul className="space-y-2 max-h-96 overflow-y-auto">
        {order.participants.map((p) => {
          const d = drafts[p._id];
          const dirty = d.name.trim() !== p.name || d.shirt_size !== p.shirt_size;
          const msg = messages[p._id] || {};
          return (
            <li key={p._id} className="bg-white rounded-lg p-2">
              <div className="grid grid-cols-[1fr_5.5rem] sm:grid-cols-[3.5rem_1fr_6rem_5rem] gap-2 items-center">
                <span className="hidden sm:block font-mono font-bold text-orange-700 text-sm">{p.bib_number || ''}</span>
                <input
                  aria-label={`Name of runner ${p.bib_number || ''}`}
                  value={d.name}
                  onChange={(e) => change(p._id, 'name', e.target.value)}
                  className="px-3 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500"
                />
                <select
                  aria-label={`Shirt size of ${p.name}`}
                  value={d.shirt_size}
                  disabled={order.kit_collected}
                  onChange={(e) => change(p._id, 'shirt_size', e.target.value)}
                  className="px-2 py-2 border-2 border-slate-200 rounded-lg bg-white disabled:bg-slate-100"
                >
                  {SHIRT_SIZES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <button
                  onClick={() => save(p)}
                  disabled={!dirty || saving === p._id}
                  className="col-span-2 sm:col-span-1 bg-slate-900 text-white font-bold py-2 rounded-lg disabled:opacity-30"
                >
                  {saving === p._id ? '…' : 'Save'}
                </button>
              </div>
              {msg.ok && <p className="text-sm text-green-700 font-semibold mt-1">{msg.ok}</p>}
              {msg.error && <p className="text-sm text-red-600 font-semibold mt-1">{msg.error}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
