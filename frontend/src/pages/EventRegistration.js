import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../utils/apiClient';
import { useAuth } from '../context/AuthContext';
import MemberTable from '../components/registration/MemberTable';
import CsvUpload from '../components/registration/CsvUpload';
import ShirtSizeSummary from '../components/registration/ShirtSizeSummary';
import {
  SHIRT_SIZES,
  MIN_GROUP_SIZE,
  MAX_GROUP_SIZE,
  emptyRow,
  isBlankRow,
  cleanRow,
  validateRows,
  serverErrorsByRow,
  shirtSizeCounts,
} from '../utils/participants';

// Registration for one event, creating an Order (see backend /api/orders).
//   Individual: Details → Review → Done
//   Group:      Group details → Members (CSV or table) → Review → Done
// All member details are collected BEFORE payment. Payment is attached to the Done step.

const STEPS = {
  individual: [
    { key: 'details', label: 'Details' },
    { key: 'review', label: 'Review' },
    { key: 'done', label: 'Payment' },
  ],
  group: [
    { key: 'details', label: 'Group' },
    { key: 'members', label: 'Members' },
    { key: 'review', label: 'Review' },
    { key: 'done', label: 'Payment' },
  ],
};

const label = 'block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide';
const input =
  'w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 transition text-lg';
const primaryBtn =
  'bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-4 px-6 rounded-lg shadow-lg hover:shadow-xl transition duration-300 disabled:opacity-50 text-lg uppercase tracking-wide';
const secondaryBtn =
  'bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold py-4 px-6 rounded-lg transition duration-300 uppercase tracking-wide';

const money = (n) => `RM ${Number(n || 0).toFixed(2)}`;

export default function EventRegistration() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [type, setType] = useState('individual');
  const [step, setStep] = useState('details');

  const [form, setForm] = useState({ race_category: '', emergency_contact: '', group_name: '', expected_size: '' });
  const [self, setSelf] = useState({ name: '', email: '', shirt_size: 'M' }); // individual runner
  const [rows, setRows] = useState(() => Array.from({ length: 5 }, emptyRow)); // group members
  const [serverRowErrors, setServerRowErrors] = useState(null);
  const [showRowErrors, setShowRowErrors] = useState(false);
  const [consent, setConsent] = useState(false);

  const [order, setOrder] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [paymentMode, setPaymentMode] = useState(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    apiClient
      .get('/payments/config')
      .then((res) => setPaymentMode(res.data.mode))
      .catch(() => setPaymentMode(null));
  }, []);

  useEffect(() => {
    apiClient
      .get(`/events/${eventId}`)
      .then((res) => {
        const ev = res.data.event;
        setEvent(ev);
        setForm((f) => ({ ...f, race_category: ev.categories?.[0]?.name || '' }));
      })
      .catch(() => setError('Failed to load event'))
      .finally(() => setLoading(false));
  }, [eventId]);

  // Pre-fill the individual runner from the logged-in account.
  useEffect(() => {
    if (user) setSelf((s) => ({ ...s, name: s.name || user.name || '', email: s.email || user.email || '' }));
  }, [user]);

  const price = event?.categories?.find((c) => c.name === form.race_category)?.price || 0;
  const filledRows = useMemo(() => rows.filter((r) => !isBlankRow(r)), [rows]);
  // Live client-side errors; replaced by the server's errors after a rejected submit until
  // the user edits the table again.
  const rowErrors = useMemo(() => serverRowErrors || validateRows(rows), [rows, serverRowErrors]);
  const memberCount = type === 'group' ? filledRows.length : 1;
  const total = price * memberCount;
  const counts = useMemo(
    () => (type === 'group' ? shirtSizeCounts(filledRows) : shirtSizeCounts([self])),
    [type, filledRows, self]
  );
  const expected = parseInt(form.expected_size, 10) || 0;

  const registrationClosed =
    event && (event.status !== 'published' || new Date(event.date) <= new Date());

  const setField = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const setRowsAndClearServerErrors = (updater) => {
    setServerRowErrors(null);
    setRows(updater);
  };
  const go = (next) => {
    setError('');
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ---- Step transitions --------------------------------------------------------
  const continueFromDetails = (e) => {
    e.preventDefault();
    if (!form.emergency_contact.trim()) return setError('Emergency contact is required');
    if (type === 'individual') {
      if (!self.name.trim()) return setError('Please enter your full name');
      if (!SHIRT_SIZES.includes(self.shirt_size)) return setError('Please choose a shirt size');
      return go('review');
    }
    if (!form.group_name.trim()) return setError('Group name is required');
    return go('members');
  };

  const continueFromMembers = () => {
    // Drop empty rows so the table rows match exactly what is sent (row numbers stay aligned
    // with the server's error messages).
    const kept = rows.filter((r) => !isBlankRow(r));
    setRowsAndClearServerErrors(kept.length ? kept : [emptyRow()]);
    setShowRowErrors(true);

    if (kept.length < MIN_GROUP_SIZE) return setError(`A group needs at least ${MIN_GROUP_SIZE} members`);
    if (kept.length > MAX_GROUP_SIZE) return setError(`A group can have at most ${MAX_GROUP_SIZE} members`);
    const errs = validateRows(kept);
    if (Object.keys(errs).length > 0) {
      return setError(`Please fix ${Object.keys(errs).length} row(s) highlighted below`);
    }
    return go('review');
  };

  const submit = async () => {
    setSubmitting(true);
    setError('');
    const participants = type === 'group' ? filledRows.map(cleanRow) : [cleanRow(self)];
    try {
      const res = await apiClient.post('/orders', {
        event_id: eventId,
        type,
        race_category: form.race_category,
        group_name: type === 'group' ? form.group_name.trim() : undefined,
        emergency_contact: form.emergency_contact.trim(),
        consent_given: type === 'group' ? consent : undefined,
        participants: participants.map((p) => ({ ...p, email: p.email || undefined })),
      });
      setOrder(res.data.order);
      setWarnings(res.data.warnings || []);
      go('done');
    } catch (err) {
      const data = err.response?.data || {};
      setError(data.message || 'Registration failed. Please try again.');
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        if (type === 'group') {
          setServerRowErrors(serverErrorsByRow(data.errors));
          setShowRowErrors(true);
          setStep('members');
        } else {
          setError(data.errors.map((x) => x.message.replace(/^Row 1: /, '')).join('. '));
          setStep('details');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Demo payment (PAYMENT_MODE=mock). The server charges order.total_amount, never a client value.
  const payMock = async (simulate) => {
    setPaying(true);
    setError('');
    try {
      await apiClient.post(`/payments/orders/${order.order_no}/mock`, simulate ? { simulate } : {});
      const res = await apiClient.get(`/orders/${order.order_no}`); // reload with bib numbers
      setOrder(res.data.order);
    } catch (err) {
      setError(err.response?.data?.message || 'Payment failed. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  // ---- Render ----------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-semibold">Loading registration form...</p>
        </div>
      </div>
    );
  }

  const steps = STEPS[type];
  const stepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="bg-gradient-to-b from-slate-50 via-white to-orange-50 min-h-screen py-8 sm:py-12 px-4 sm:px-6">
      <div className={`${step === 'members' ? 'max-w-5xl' : 'max-w-3xl'} mx-auto`}>
        {step !== 'done' && (
          <button
            onClick={() => (stepIndex > 0 ? go(steps[stepIndex - 1].key) : navigate(-1))}
            className="text-orange-600 hover:text-orange-700 font-bold mb-6 inline-block text-lg"
          >
            ← Back
          </button>
        )}

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-slate-900 via-red-700 to-orange-600 p-6 sm:p-8 text-white">
            <h1 className="text-2xl sm:text-3xl font-black mb-2">Register for {event?.event_name}</h1>
            <p className="text-orange-100">
              {event?.date && new Date(event.date).toLocaleDateString('en-MY', { dateStyle: 'full' })}
              {event?.location && ` · ${event.location}`}
            </p>
          </div>

          <div className="p-5 sm:p-8">
            {registrationClosed ? (
              <div className="bg-slate-100 border-l-4 border-slate-500 text-slate-700 p-4 rounded-lg font-semibold">
                Registration for this event is closed.
              </div>
            ) : (
              <>
                {/* Step indicator */}
                <div className="flex justify-between mb-8">
                  {steps.map((s, i) => (
                    <div
                      key={s.key}
                      className={`flex-1 text-center pb-3 border-b-4 ${i <= stepIndex ? 'border-orange-600' : 'border-slate-200'}`}
                    >
                      <div
                        className={`w-9 h-9 mx-auto mb-2 rounded-full flex items-center justify-center font-bold text-white ${
                          i <= stepIndex ? 'bg-gradient-to-r from-orange-500 to-red-600' : 'bg-slate-300'
                        }`}
                      >
                        {i + 1}
                      </div>
                      <p
                        className={`font-bold uppercase tracking-wide text-xs sm:text-sm ${
                          i <= stepIndex ? 'text-orange-600' : 'text-slate-500'
                        }`}
                      >
                        {s.label}
                      </p>
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-6 font-semibold">
                    {error}
                  </div>
                )}

                {step === 'details' && (
                  <form onSubmit={continueFromDetails} className="space-y-6">
                    <div>
                      <span className={label}>Registration type *</span>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          ['individual', 'Individual', 'Just me'],
                          ['group', 'Group', `${MIN_GROUP_SIZE}–${MAX_GROUP_SIZE} runners, one payment`],
                        ].map(([value, title, sub]) => (
                          <button
                            type="button"
                            key={value}
                            onClick={() => setType(value)}
                            className={`text-left p-4 rounded-xl border-2 transition ${
                              type === value ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <p className="font-bold text-slate-900">{title}</p>
                            <p className="text-sm text-slate-600">{sub}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="race_category" className={label}>
                        Race category *
                      </label>
                      <select id="race_category" name="race_category" value={form.race_category} onChange={setField} className={input}>
                        {event?.categories?.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name} · {money(c.price)}
                            {type === 'group' ? ' per person' : ''}
                          </option>
                        ))}
                      </select>
                      {type === 'group' && (
                        <p className="text-sm text-slate-500 mt-1">The whole group runs the same category.</p>
                      )}
                    </div>

                    {type === 'individual' ? (
                      <>
                        <div>
                          <label htmlFor="self_name" className={label}>
                            Full name (as it should appear on your certificate) *
                          </label>
                          <input
                            id="self_name"
                            value={self.name}
                            onChange={(e) => setSelf({ ...self, name: e.target.value })}
                            className={input}
                          />
                        </div>
                        <div>
                          <label htmlFor="self_email" className={label}>
                            Email
                          </label>
                          <input
                            id="self_email"
                            type="email"
                            value={self.email}
                            onChange={(e) => setSelf({ ...self, email: e.target.value })}
                            className={input}
                          />
                        </div>
                        <div>
                          <label htmlFor="self_size" className={label}>
                            Shirt size *
                          </label>
                          <select
                            id="self_size"
                            value={self.shirt_size}
                            onChange={(e) => setSelf({ ...self, shirt_size: e.target.value })}
                            className={input}
                          >
                            {SHIRT_SIZES.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label htmlFor="group_name" className={label}>
                            Group / organisation name *
                          </label>
                          <input
                            id="group_name"
                            name="group_name"
                            value={form.group_name}
                            onChange={setField}
                            placeholder="e.g. Kelab Larian Surau"
                            className={input}
                          />
                        </div>
                        <div>
                          <label htmlFor="expected_size" className={label}>
                            Expected number of runners
                          </label>
                          <input
                            id="expected_size"
                            name="expected_size"
                            type="number"
                            min={MIN_GROUP_SIZE}
                            max={MAX_GROUP_SIZE}
                            value={form.expected_size}
                            onChange={setField}
                            placeholder="Optional, helps you track progress"
                            className={input}
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label htmlFor="emergency_contact" className={label}>
                        {type === 'group' ? 'Emergency contact (group leader) *' : 'Emergency contact *'}
                      </label>
                      <input
                        id="emergency_contact"
                        name="emergency_contact"
                        type="tel"
                        value={form.emergency_contact}
                        onChange={setField}
                        placeholder="Phone number"
                        className={input}
                      />
                    </div>

                    <button type="submit" className={`w-full ${primaryBtn}`}>
                      Continue →
                    </button>
                  </form>
                )}

                {step === 'members' && (
                  <div className="space-y-6">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="text-xl font-black text-slate-900">Members of {form.group_name}</h2>
                      <p className="font-bold text-slate-700">
                        {filledRows.length}
                        {expected > 0 ? ` of ${expected}` : ''} added
                        <span className="text-slate-500 font-semibold"> · max {MAX_GROUP_SIZE}</span>
                      </p>
                    </div>
                    {expected > 0 && (
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-red-600"
                          style={{ width: `${Math.min(100, (filledRows.length / expected) * 100)}%` }}
                        />
                      </div>
                    )}

                    <CsvUpload
                      hasExistingRows={filledRows.length > 0}
                      onLoaded={(loaded) => {
                        setRowsAndClearServerErrors(loaded);
                        setShowRowErrors(true);
                        setError('');
                      }}
                    />

                    <div>
                      <p className="font-bold text-slate-800 mb-1">…or type the members in</p>
                      <p className="text-sm text-slate-600 mb-3">
                        Email is optional. Runners with an email get their certificate sent to them after the event;
                        for the others, you download it from My Tickets.
                      </p>
                      <MemberTable
                        rows={rows}
                        setRows={setRowsAndClearServerErrors}
                        errors={rowErrors}
                        showErrors={showRowErrors || Boolean(serverRowErrors)}
                      />
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-2">Shirt sizes so far</p>
                      <ShirtSizeSummary counts={counts} />
                    </div>

                    <button type="button" onClick={continueFromMembers} className={`w-full ${primaryBtn}`}>
                      Review →
                    </button>
                  </div>
                )}

                {step === 'review' && (
                  <div className="space-y-6">
                    <div className="bg-slate-50 rounded-xl p-5 space-y-2">
                      <Row k="Event" v={event?.event_name} />
                      <Row k="Category" v={form.race_category} />
                      {type === 'group' ? (
                        <>
                          <Row k="Group" v={form.group_name} />
                          <Row k="Runners" v={memberCount} />
                        </>
                      ) : (
                        <>
                          <Row k="Name" v={self.name} />
                          {self.email && <Row k="Email" v={self.email} />}
                          <Row k="Shirt size" v={self.shirt_size} />
                        </>
                      )}
                      <Row k="Emergency contact" v={form.emergency_contact} />
                    </div>

                    {type === 'group' && (
                      <>
                        <div>
                          <p className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-2">Shirt sizes</p>
                          <ShirtSizeSummary counts={counts} />
                        </div>
                        <details className="bg-slate-50 rounded-xl p-4">
                          <summary className="font-bold text-slate-800 cursor-pointer">
                            Show all {memberCount} members
                          </summary>
                          <ol className="mt-3 space-y-1 text-sm text-slate-700 list-decimal list-inside">
                            {filledRows.map((r, i) => {
                              const c = cleanRow(r);
                              return (
                                <li key={i}>
                                  {c.name} · {c.shirt_size}
                                  {c.email && <span className="text-slate-500"> · {c.email}</span>}
                                </li>
                              );
                            })}
                          </ol>
                        </details>
                      </>
                    )}

                    <div className="bg-gradient-to-br from-orange-100 to-red-100 border-2 border-orange-300 p-6 rounded-xl">
                      <p className="text-sm font-bold text-slate-700 uppercase mb-1 tracking-wide">Total</p>
                      <p className="text-4xl font-black text-orange-700">{money(total)}</p>
                      {type === 'group' && (
                        <p className="text-sm text-slate-700 font-semibold mt-1">
                          {memberCount} × {money(price)}
                        </p>
                      )}
                    </div>

                    {type === 'group' && (
                      <label className="flex items-start gap-3 bg-blue-50 border-2 border-blue-200 rounded-xl p-4 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={consent}
                          onChange={(e) => setConsent(e.target.checked)}
                          className="w-5 h-5 mt-1 accent-orange-600"
                        />
                        <span className="text-slate-800">
                          I confirm that all members listed have agreed to share their details (name, email, shirt
                          size) with the organiser for this event.
                        </span>
                      </label>
                    )}

                    <button
                      type="button"
                      onClick={submit}
                      disabled={submitting || (type === 'group' && !consent)}
                      className={`w-full ${primaryBtn}`}
                    >
                      {submitting ? 'Saving…' : 'Confirm registration →'}
                    </button>
                  </div>
                )}

                {step === 'done' && order?.status === 'paid' && (
                  <div className="space-y-6">
                    <div className="bg-green-100 border-2 border-green-500 text-green-800 p-5 rounded-xl">
                      <p className="font-black text-lg">✓ Payment successful: you're registered!</p>
                      <p className="font-semibold">
                        Order {order.order_no} · {money(order.total_amount)}
                      </p>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-5">
                      <p className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-3">
                        {order.participant_count === 1 ? 'Bib number' : `Bib numbers (${order.participant_count} runners)`}
                      </p>
                      <ul className="divide-y divide-slate-200 max-h-80 overflow-y-auto">
                        {order.participants?.map((p) => (
                          <li key={p._id} className="flex justify-between py-2">
                            <span className="text-slate-800">{p.name}</span>
                            <span className="font-mono font-black text-orange-700">{p.bib_number}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <p className="text-slate-600 text-sm">
                      Your QR code for kit collection will be in My Tickets.
                      {order.type === 'group' &&
                        ' One QR covers the whole group: you can collect for everyone, or runners can come separately with the same QR.'}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button onClick={() => navigate('/my-tickets')} className={`flex-1 ${primaryBtn}`}>
                        My Tickets
                      </button>
                      <button onClick={() => navigate('/events')} className={`flex-1 ${secondaryBtn}`}>
                        Browse more events
                      </button>
                    </div>
                  </div>
                )}

                {step === 'done' && order && order.status !== 'paid' && (
                  <div className="space-y-6">
                    <div className="bg-green-100 border-2 border-green-500 text-green-800 p-5 rounded-xl">
                      <p className="font-black text-lg">Registration saved: {order.order_no}</p>
                      <p className="font-semibold">
                        Your {order.participant_count === 1 ? 'slot is' : `${order.participant_count} slots are`} held for
                        30 minutes. Complete payment to confirm.
                      </p>
                    </div>

                    {warnings.length > 0 && (
                      <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 p-4 rounded-lg">
                        <p className="font-bold mb-1">Please double-check:</p>
                        <ul className="list-disc list-inside text-sm">
                          {warnings.map((w) => (
                            <li key={w.message}>{w.message}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="bg-gradient-to-br from-orange-100 to-red-100 border-2 border-orange-300 p-6 rounded-xl">
                      <p className="text-sm font-bold text-slate-700 uppercase mb-1 tracking-wide">Amount due</p>
                      <p className="text-4xl font-black text-orange-700">{money(order.total_amount)}</p>
                    </div>

                    {paymentMode === 'mock' ? (
                      <div className="space-y-3">
                        <div className="bg-slate-50 border-2 border-slate-200 p-4 rounded-xl text-slate-700 text-sm">
                          <span className="font-bold">Demo payment.</span> No real money is charged.
                        </div>
                        <button
                          type="button"
                          onClick={() => payMock()}
                          disabled={paying}
                          className={`w-full ${primaryBtn}`}
                        >
                          {paying ? 'Processing…' : `Pay ${money(order.total_amount)}`}
                        </button>
                        <button
                          type="button"
                          onClick={() => payMock('fail')}
                          disabled={paying}
                          className="w-full text-sm text-slate-500 hover:text-slate-700 underline"
                        >
                          Simulate a failed payment
                        </button>
                      </div>
                    ) : (
                      // TODO(stripe): redirect to Stripe Checkout when PAYMENT_MODE=stripe.
                      <div className="bg-slate-50 border-2 border-slate-200 p-5 rounded-xl text-slate-700">
                        Online payment is not available yet.
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button onClick={() => navigate('/events')} className={`flex-1 ${secondaryBtn}`}>
                        Browse more events
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500 font-semibold">{k}</span>
      <span className="text-slate-900 font-bold text-right">{v}</span>
    </div>
  );
}
