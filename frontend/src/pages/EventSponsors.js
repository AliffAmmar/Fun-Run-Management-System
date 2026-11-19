import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import apiClient from '../utils/apiClient';
import { imageSrc, prepareImage } from '../utils/eventImages';

// Organizer: sponsors of one event (Sponsor Management). Tiers are named by the organizer and
// ranked (1 = top). Only the agreed contribution is recorded.
const money = (n) => `RM ${Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const STATUS = {
  confirmed: ['Confirmed', 'bg-green-100 text-green-800'],
  prospect: ['Prospect', 'bg-amber-100 text-amber-800'],
  cancelled: ['Cancelled', 'bg-slate-200 text-slate-600'],
};
const EMPTY = {
  name: '',
  tier: '',
  tier_order: 1,
  contribution_type: 'cash',
  amount: '',
  in_kind_description: '',
  website_url: '',
  status: 'confirmed',
  show_on_event_page: true,
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  notes: '',
};
const input = 'w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500';
const label = 'block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1';
const btn = 'font-bold py-2 px-4 rounded-lg transition disabled:opacity-50';

export default function EventSponsors() {
  const { eventId } = useParams();
  const base = `/events/${eventId}/sponsors`;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | sponsorId
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const logoInput = useRef(null);
  const [logoFor, setLogoFor] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get(`${base}/manage`);
      setData(res.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load sponsors');
    }
  }, [base]);

  useEffect(() => {
    load();
  }, [load]);

  // Existing tiers (name → rank), so typing a known tier keeps the same rank.
  const tiers = useMemo(() => {
    const m = new Map();
    (data?.sponsors || []).forEach((s) => {
      if (!m.has(s.tier)) m.set(s.tier, s.tier_order);
    });
    return m;
  }, [data]);

  const groups = useMemo(() => {
    const g = new Map();
    (data?.sponsors || []).forEach((s) => {
      if (!g.has(s.tier)) g.set(s.tier, { tier: s.tier, order: s.tier_order, list: [] });
      g.get(s.tier).list.push(s);
    });
    return [...g.values()].sort((a, b) => a.order - b.order);
  }, [data]);

  const run = async (fn, ok) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fn();
      setNotice(res?.data?.message || ok);
      await load();
      return true;
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Something went wrong');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const startNew = () => {
    setForm(EMPTY);
    setEditing('new');
  };
  const startEdit = (s) => {
    setForm({
      ...EMPTY,
      ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, s[k] ?? EMPTY[k]])),
      amount: s.amount ? String(s.amount) : '',
    });
    setEditing(s._id);
  };
  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (field === 'tier' && tiers.has(value.trim())) next.tier_order = tiers.get(value.trim());
      return next;
    });
  };

  const save = async (e) => {
    e.preventDefault();
    const body = { ...form, tier_order: Number(form.tier_order) || 1, amount: form.contribution_type === 'cash' ? form.amount : 0 };
    const ok = await run(
      () => (editing === 'new' ? apiClient.post(base, body) : apiClient.put(`${base}/${editing}`, body)),
      'Saved'
    );
    if (ok) setEditing(null);
  };

  const remove = (s) => {
    if (!window.confirm(`Remove ${s.name} from this event's sponsors?`)) return;
    run(() => apiClient.delete(`${base}/${s._id}`), 'Sponsor removed');
  };

  const onLogoPicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !logoFor) return;
    await run(async () => {
      const { blob, type } = await prepareImage(file);
      return apiClient.put(`${base}/${logoFor}/logo`, blob, { headers: { 'Content-Type': type } });
    }, 'Logo saved');
    setLogoFor(null);
  };

  if (!data) {
    return <Page>{error ? <p className="text-red-700 font-bold">{error}</p> : <p className="text-slate-600 font-semibold">Loading…</p>}</Page>;
  }
  const { summary, event } = data;

  return (
    <Page>
      <div>
        <Link to="/manage-events" className="text-orange-600 font-bold">
          ← My Events
        </Link>
        <h1 className="text-3xl font-black text-slate-900 mt-2">Sponsors</h1>
        <p className="text-slate-600">{event.event_name}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Confirmed sponsors" value={summary.sponsor_count} />
        <Stat label="Cash sponsorship" value={money(summary.total_cash)} detail={`${summary.in_kind.length} in-kind`} />
        <Stat label="Prospects" value={summary.prospect_count} detail={summary.prospect_cash ? `${money(summary.prospect_cash)} if confirmed` : ''} />
      </div>

      {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg font-semibold">{error}</div>}
      {notice && <div className="bg-green-100 border-l-4 border-green-500 text-green-800 p-4 rounded-lg font-semibold">{notice}</div>}

      {editing ? (
        <form onSubmit={save} className="bg-white rounded-2xl shadow-lg p-5 space-y-4">
          <h2 className="text-xl font-black text-slate-900">{editing === 'new' ? 'Add sponsor' : 'Edit sponsor'}</h2>
          <div>
            <label htmlFor="sp-name" className={label}>
              Sponsor name *
            </label>
            <input id="sp-name" required maxLength={100} value={form.name} onChange={set('name')} className={input} />
          </div>
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <div>
              <label htmlFor="sp-tier" className={label}>
                Tier (your own name)
              </label>
              <input
                id="sp-tier"
                list="sp-tiers"
                maxLength={40}
                value={form.tier}
                onChange={set('tier')}
                placeholder="e.g. Platinum, Water partner"
                className={input}
              />
              <datalist id="sp-tiers">
                {[...tiers.keys()].map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor="sp-rank" className={label}>
                Rank
              </label>
              <input id="sp-rank" type="number" min="1" max="99" value={form.tier_order} onChange={set('tier_order')} className={input} />
            </div>
          </div>
          <p className="text-xs text-slate-500 -mt-2">Rank 1 is shown first (biggest logos). Sponsors in the same tier share a rank.</p>

          <div>
            <span className={label}>Contribution</span>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {[
                ['cash', 'Cash (RM)'],
                ['in_kind', 'In-kind (goods/services)'],
              ].map(([v, l]) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => setForm((f) => ({ ...f, contribution_type: v }))}
                  className={`${btn} border-2 ${form.contribution_type === v ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-white'}`}
                >
                  {l}
                </button>
              ))}
            </div>
            {form.contribution_type === 'cash' ? (
              <input aria-label="Agreed amount (RM)" type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} placeholder="Agreed amount in RM" className={input} />
            ) : (
              <input aria-label="What they provide" maxLength={200} value={form.in_kind_description} onChange={set('in_kind_description')} placeholder="e.g. 500 bottles of water" className={input} />
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="sp-status" className={label}>
                Status
              </label>
              <select id="sp-status" value={form.status} onChange={set('status')} className={`${input} bg-white`}>
                <option value="confirmed">Confirmed</option>
                <option value="prospect">Prospect (still asking)</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label htmlFor="sp-web" className={label}>
                Website
              </label>
              <input id="sp-web" type="url" value={form.website_url} onChange={set('website_url')} placeholder="https://…" className={input} />
            </div>
          </div>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={form.show_on_event_page} onChange={set('show_on_event_page')} className="w-5 h-5 accent-orange-600" />
            <span className="text-slate-800">Show on the event page (only when confirmed), certificates and confirmation emails</span>
          </label>

          <details className="bg-slate-50 rounded-xl p-3">
            <summary className="font-bold text-slate-800 cursor-pointer">Contact person (only you can see this)</summary>
            <div className="grid sm:grid-cols-3 gap-3 mt-3">
              <input aria-label="Contact name" maxLength={100} value={form.contact_name} onChange={set('contact_name')} placeholder="Name" className={input} />
              <input aria-label="Contact email" type="email" value={form.contact_email} onChange={set('contact_email')} placeholder="Email" className={input} />
              <input aria-label="Contact phone" type="tel" value={form.contact_phone} onChange={set('contact_phone')} placeholder="Phone" className={input} />
            </div>
            <textarea aria-label="Notes" rows={2} maxLength={500} value={form.notes} onChange={set('notes')} placeholder="Notes" className={`${input} mt-3`} />
          </details>

          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={`${btn} bg-gradient-to-r from-orange-500 to-red-600 text-white`}>
              {busy ? 'Saving…' : 'Save sponsor'}
            </button>
            <button type="button" onClick={() => setEditing(null)} className={`${btn} bg-slate-100`}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button onClick={startNew} className={`${btn} py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white shadow`}>
          + Add sponsor
        </button>
      )}

      {groups.length === 0 && !editing && (
        <div className="bg-white rounded-2xl shadow p-8 text-center text-slate-500">No sponsors yet</div>
      )}

      {groups.map((g) => (
        <section key={g.tier} className="space-y-3">
          <h2 className="text-lg font-black text-slate-700 uppercase tracking-wide">
            {g.tier} <span className="text-sm text-slate-400 normal-case">· rank {g.order}</span>
          </h2>
          {g.list.map((s) => (
            <div key={s._id} className="bg-white rounded-2xl shadow p-4 flex flex-col sm:flex-row gap-4">
              <div className="w-full sm:w-32 h-20 rounded-lg border border-slate-200 bg-white flex items-center justify-center shrink-0">
                {s.logo_url ? (
                  <img src={imageSrc(s.logo_url)} alt={`${s.name} logo`} className="max-h-16 max-w-[7rem] object-contain" />
                ) : (
                  <span className="text-xs text-slate-400">No logo</span>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black text-slate-900">{s.name}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS[s.status][1]}`}>{STATUS[s.status][0]}</span>
                  {!s.show_on_event_page && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">Hidden</span>}
                </div>
                <p className="text-slate-700">
                  {s.contribution_type === 'cash' ? money(s.amount) : `In-kind: ${s.in_kind_description || '—'}`}
                </p>
                {s.website_url && (
                  <a href={s.website_url} target="_blank" rel="noopener noreferrer" className="text-sm text-orange-600 break-all">
                    {s.website_url}
                  </a>
                )}
                {(s.contact_name || s.contact_email || s.contact_phone) && (
                  <p className="text-sm text-slate-500">
                    Contact: {[s.contact_name, s.contact_email, s.contact_phone].filter(Boolean).join(' · ')}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button onClick={() => startEdit(s)} className={`${btn} bg-slate-900 text-white text-sm`}>
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setLogoFor(s._id);
                      logoInput.current?.click();
                    }}
                    disabled={busy}
                    className={`${btn} bg-slate-100 text-sm`}
                  >
                    {s.logo_url ? 'Replace logo' : 'Upload logo'}
                  </button>
                  {s.logo_url && (
                    <button onClick={() => run(() => apiClient.delete(`${base}/${s._id}/logo`), 'Logo removed')} disabled={busy} className={`${btn} bg-slate-100 text-sm`}>
                      Remove logo
                    </button>
                  )}
                  <button onClick={() => remove(s)} disabled={busy} className={`${btn} bg-white border-2 border-slate-200 text-red-600 text-sm`}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </section>
      ))}
      <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={onLogoPicked} />
    </Page>
  );
}

function Stat({ label: l, value, detail }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{l}</p>
      <p className="text-2xl font-black text-slate-900">{value}</p>
      {detail && <p className="text-sm text-slate-500">{detail}</p>}
    </div>
  );
}

function Page({ children }) {
  return (
    <div className="bg-gradient-to-b from-slate-50 via-white to-orange-50 min-h-screen py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">{children}</div>
    </div>
  );
}
