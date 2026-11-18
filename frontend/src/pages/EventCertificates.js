import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import apiClient from '../utils/apiClient';
import { downloadFile, openFile, blobErrorMessage } from '../utils/download';

// Organizer: certificate design, "Mark event as completed", sending progress, re-send.
const ELIGIBILITY = [
  ['all_paid', 'Every paid runner', 'Everyone in a paid registration gets a certificate.'],
  ['kit_collected', 'Collected their kit', 'Only runners ticked as having collected their kit.'],
  ['checked_in', 'Checked in on event day', 'Only runners ticked as checked in on the day.'],
];
const STATUS = {
  pending: ['Sending…', 'bg-yellow-100 text-yellow-800'],
  sent: ['Emailed', 'bg-green-100 text-green-800'],
  skipped_no_email: ['No email (buyer downloads)', 'bg-slate-100 text-slate-700'],
  failed: ['Failed', 'bg-red-100 text-red-700'],
};
const card = 'bg-white rounded-2xl shadow-lg p-5 sm:p-6 space-y-4';
const btn = 'font-bold py-3 px-5 rounded-lg transition disabled:opacity-50';
const primary = `${btn} bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow`;
const secondary = `${btn} bg-slate-100 hover:bg-slate-200 text-slate-800`;

export default function EventCertificates() {
  const { eventId } = useParams();
  const base = `/certificates/events/${eventId}`;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [previewName, setPreviewName] = useState('Nur Aisyah binti Ahmad');
  const [editing, setEditing] = useState(null); // certificate_no being renamed
  const [newName, setNewName] = useState('');
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get(base);
      setData(res.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load certificates');
    }
  }, [base]);

  useEffect(() => {
    load();
  }, [load]);

  // While certificates are still being sent, refresh every 5 seconds.
  useEffect(() => {
    if (!data?.counts?.pending) return undefined;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [data?.counts?.pending, load]);

  const run = async (fn, okMessage) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fn();
      setNotice(res?.data?.message || okMessage || 'Done');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || (await blobErrorMessage(err, 'Something went wrong')));
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return (
      <Page>
        {error ? <p className="text-red-700 font-bold">{error}</p> : <p className="text-slate-600 font-semibold">Loading…</p>}
      </Page>
    );
  }

  const { event, counts, certificates, eligible_count: eligibleCount, has_background: hasBackground } = data;
  const completed = event.status === 'completed';
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const notYet = new Date(event.date) > endOfToday;

  const saveSetting = (body) => run(() => apiClient.put(`${base}/settings`, body), 'Saved');
  const uploadBackground = (file) =>
    run(
      () => apiClient.put(`${base}/background`, file, { headers: { 'Content-Type': file.type } }),
      'Background uploaded'
    );
  const completeEvent = () => {
    const msg = completed
      ? 'Create certificates for any eligible runners who do not have one yet, and send them?'
      : `Mark "${event.event_name}" as completed and send ${eligibleCount} certificate(s)? This cannot be undone.`;
    if (window.confirm(msg)) run(() => apiClient.post(`${base}/complete`));
  };

  return (
    <Page>
      <div>
        <Link to="/manage-events" className="text-orange-600 font-bold">
          ← My Events
        </Link>
        <h1 className="text-3xl font-black text-slate-900 mt-2">Certificates</h1>
        <p className="text-slate-600">
          {event.event_name} · {new Date(event.date).toLocaleDateString('en-MY', { dateStyle: 'long' })}
        </p>
      </div>

      {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg font-semibold">{error}</div>}
      {notice && <div className="bg-green-100 border-l-4 border-green-500 text-green-800 p-4 rounded-lg font-semibold">{notice}</div>}

      {/* ---- Design ---- */}
      <section className={card}>
        <h2 className="text-xl font-black text-slate-900">1. Design</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="font-bold text-slate-800 mb-2">Background</p>
            <p className="text-sm text-slate-600 mb-3">
              {hasBackground ? 'Your image is used.' : 'Built-in design.'} Optional: A4 landscape PNG or JPEG, up to 4 MB.
            </p>
            <div className="flex flex-wrap gap-2">
              <button className={secondary} disabled={busy} onClick={() => fileRef.current?.click()}>
                {hasBackground ? 'Replace image' : 'Upload image'}
              </button>
              {hasBackground && (
                <button className={secondary} disabled={busy} onClick={() => run(() => apiClient.delete(`${base}/background`))}>
                  Use built-in design
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) uploadBackground(f);
                }}
              />
            </div>
          </div>
          <div>
            <p className="font-bold text-slate-800 mb-2">Text colour</p>
            <div className="flex gap-2">
              {[
                ['dark', 'Dark text (light background)'],
                ['light', 'Light text (dark background)'],
              ].map(([v, label]) => (
                <button
                  key={v}
                  disabled={busy}
                  onClick={() => saveSetting({ certificate_text_color: v })}
                  className={`flex-1 text-sm ${btn} border-2 ${
                    event.certificate_text_color === v ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={previewName}
            onChange={(e) => setPreviewName(e.target.value)}
            aria-label="Sample name for preview"
            className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500"
          />
          <button
            className={secondary}
            onClick={() =>
              openFile(`${base}/preview?name=${encodeURIComponent(previewName)}`).catch(async (err) =>
                setError(await blobErrorMessage(err, 'Preview failed'))
              )
            }
          >
            Preview PDF
          </button>
        </div>
      </section>

      {/* ---- Who ---- */}
      <section className={card}>
        <h2 className="text-xl font-black text-slate-900">2. Who gets a certificate</h2>
        <div className="grid sm:grid-cols-3 gap-2">
          {ELIGIBILITY.map(([v, title, sub]) => (
            <button
              key={v}
              disabled={busy}
              onClick={() => saveSetting({ certificate_eligibility: v })}
              className={`text-left p-4 rounded-xl border-2 transition ${
                event.certificate_eligibility === v ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className="font-bold text-slate-900">{title}</p>
              <p className="text-sm text-slate-600">{sub}</p>
            </button>
          ))}
        </div>
        <p className="font-semibold text-slate-700">{eligibleCount} runner(s) eligible with this setting.</p>
      </section>

      {/* ---- Complete & send ---- */}
      <section className={card}>
        <h2 className="text-xl font-black text-slate-900">3. Complete the event & send</h2>
        {completed ? (
          <p className="text-slate-700">
            Completed on {new Date(event.completed_at).toLocaleString('en-MY')}. Runners with an email get their certificate by
            email; the buyer downloads the rest from My Tickets.
          </p>
        ) : (
          <p className="text-slate-700">
            Marks the event as completed and emails a certificate to every eligible runner (in the background, up to the daily
            email limit, continuing the next day if needed).
          </p>
        )}
        <button className={primary} disabled={busy || notYet || eligibleCount === 0} onClick={completeEvent}>
          {completed ? 'Create any missing certificates' : 'Mark event as completed & send certificates'}
        </button>
        {notYet && <p className="text-sm text-slate-500">Available from the event day.</p>}

        {certificates.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {Object.entries(STATUS).map(([k, [label, cls]]) => (
              <span key={k} className={`px-3 py-1 rounded-full text-sm font-bold ${cls}`}>
                {label}: {counts[k]}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ---- List ---- */}
      {certificates.length > 0 && (
        <section className={card}>
          <h2 className="text-xl font-black text-slate-900">Certificates ({certificates.length})</h2>
          <ul className="divide-y divide-slate-100">
            {certificates.map((c) => (
              <li key={c.certificate_no} className="py-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">
                      {c.name} {c.bib_number && <span className="font-mono text-orange-700">· {c.bib_number}</span>}
                    </p>
                    <p className="text-sm text-slate-500">
                      {c.email || 'no email'} · {c.order_no} · <span className="font-mono">{c.certificate_no}</span>
                    </p>
                    {c.error && <p className="text-sm text-red-600">{c.error}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS[c.status][1]}`}>{STATUS[c.status][0]}</span>
                    <button
                      className="text-sm font-bold text-orange-600 hover:underline"
                      onClick={() =>
                        downloadFile(`/certificates/${c.certificate_no}/pdf`, `${c.certificate_no}.pdf`).catch(async (err) =>
                          setError(await blobErrorMessage(err))
                        )
                      }
                    >
                      PDF
                    </button>
                    <button
                      className="text-sm font-bold text-slate-700 hover:underline"
                      onClick={() => {
                        setEditing(c.certificate_no);
                        setNewName(c.name);
                      }}
                    >
                      Fix name / re-send
                    </button>
                  </div>
                </div>
                {editing === c.certificate_no && (
                  <form
                    className="flex flex-col sm:flex-row gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      setEditing(null);
                      run(() => apiClient.post(`/certificates/${c.certificate_no}/resend`, { name: newName }));
                    }}
                  >
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      aria-label="Corrected name"
                      className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500"
                    />
                    <button type="submit" className={primary} disabled={busy || !newName.trim()}>
                      {c.email ? 'Save & re-send' : 'Save'}
                    </button>
                    <button type="button" className={secondary} onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Page>
  );
}

function Page({ children }) {
  return (
    <div className="bg-gradient-to-b from-slate-50 via-white to-orange-50 min-h-screen py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">{children}</div>
    </div>
  );
}
