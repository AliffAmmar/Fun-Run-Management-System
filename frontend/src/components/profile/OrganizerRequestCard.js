import React, { useEffect, useState } from 'react';
import apiClient from '../../utils/apiClient';

// Participants ask for organizer access here; an admin approves or declines (Users → Requests).
const fmt = (d) => new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' });
const input =
  'w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 transition';

export default function OrganizerRequestCard() {
  const [state, setState] = useState({ loading: true, request: null });
  const [form, setForm] = useState({ organization: '', note: '' });
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () =>
    apiClient
      .get('/organizer-requests/mine')
      .then((res) => setState({ loading: false, request: res.data.request }))
      .catch(() => setState({ loading: false, request: null }));

  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiClient.post('/organizer-requests', form);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send the request');
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!window.confirm('Withdraw your organizer request?')) return;
    setBusy(true);
    try {
      await apiClient.delete('/organizer-requests/mine');
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (state.loading) return null;
  const r = state.request;

  return (
    <section className="bg-white rounded-2xl shadow-lg p-5 sm:p-6 space-y-4">
      <h2 className="text-lg font-black text-slate-900">Become an organizer</h2>

      {r?.status === 'pending' ? (
        <div className="space-y-3">
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
            <p className="font-bold text-amber-900">Request sent on {fmt(r.createdAt)}: waiting for the admin</p>
            <p className="text-sm text-amber-900 mt-1">
              {r.organization}
              {r.note && ` · ${r.note}`}
            </p>
          </div>
          <p className="text-sm text-slate-600">You'll get an email and a notification when it's reviewed.</p>
          <button onClick={withdraw} disabled={busy} className="text-sm font-bold text-slate-500 underline">
            Withdraw request
          </button>
        </div>
      ) : (
        <>
          {r?.status === 'rejected' && (
            <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4">
              <p className="font-bold text-slate-800">
                Your last request was declined{r.decided_at ? ` on ${fmt(r.decided_at)}` : ''}.
              </p>
              {r.decision_reason && <p className="text-sm text-slate-600 mt-1">Reason: {r.decision_reason}</p>}
            </div>
          )}
          {!showForm ? (
            <>
              <p className="text-slate-600">
                Want to organise a run? Ask the Run4Fun admin for organizer access. Once approved you can create events,
                check in runners and send certificates.
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-3 px-6 rounded-lg shadow"
              >
                {r?.status === 'rejected' ? 'Send a new request' : 'Request organizer access'}
              </button>
            </>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 rounded-lg font-semibold">
                  {error}
                </div>
              )}
              <div>
                <label htmlFor="org" className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">
                  Organisation / group *
                </label>
                <input
                  id="org"
                  required
                  maxLength={100}
                  value={form.organization}
                  onChange={(e) => setForm({ ...form, organization: e.target.value })}
                  placeholder="e.g. Surau Ar Rayyan"
                  className={input}
                />
              </div>
              <div>
                <label htmlFor="note" className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">
                  Note for the admin (optional)
                </label>
                <textarea
                  id="note"
                  rows={3}
                  maxLength={500}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="What kind of runs do you plan to organise?"
                  className={input}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={busy}
                  className="bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg shadow disabled:opacity-50"
                >
                  {busy ? 'Sending…' : 'Send request'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="bg-slate-100 font-bold py-3 px-6 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}
