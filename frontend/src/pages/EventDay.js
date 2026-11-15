import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../utils/apiClient';
import { getWorkingEventId, setWorkingEventId } from '../utils/workingEvent';

// Organizer's kit-collection / event-day page: pick the event being worked, see progress, and
// search when a runner has lost their QR (by order number, buyer name or member name).
export default function EventDay() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState(getWorkingEventId());
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiClient
      .get('/events/organizer/my-events')
      .then((res) => {
        const list = [...res.data.events].sort((a, b) => new Date(a.date) - new Date(b.date));
        setEvents(list);
        // Keep the stored choice if it's still one of mine; otherwise the next upcoming event.
        if (!list.some((e) => e._id === getWorkingEventId())) {
          const next = list.find((e) => new Date(e.date) >= new Date(Date.now() - 864e5)) || list[list.length - 1];
          if (next) {
            setWorkingEventId(next._id);
            setEventId(next._id);
          }
        }
      })
      .catch(() => setError('Failed to load your events'));
  }, []);

  const choose = (id) => {
    setWorkingEventId(id);
    setEventId(id);
  };

  // Debounced search; also refreshes the totals.
  useEffect(() => {
    if (!eventId) return undefined;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await apiClient.get('/checkin/search', { params: { event_id: eventId, q: q.trim() || undefined } });
        setData(res.data);
        setError('');
      } catch (err) {
        setError(err.response?.data?.message || 'Search failed');
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [eventId, q]);

  const t = data?.totals;

  return (
    <div className="bg-slate-100 min-h-screen py-4 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-black text-slate-900">Event Day</h1>

        <div className="bg-white rounded-2xl shadow p-4 space-y-2">
          <label htmlFor="working-event" className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            Event being worked
          </label>
          <select
            id="working-event"
            value={eventId}
            onChange={(e) => choose(e.target.value)}
            className="w-full px-3 py-3 border-2 border-slate-200 rounded-lg text-lg bg-white"
          >
            {events.length === 0 && <option value="">No events</option>}
            {events.map((e) => (
              <option key={e._id} value={e._id}>
                {e.event_name} · {new Date(e.date).toLocaleDateString('en-MY')}
              </option>
            ))}
          </select>
          <p className="text-sm text-slate-600">
            Scan a runner's QR with this phone's camera. Scanned QRs from another event will show a warning.
          </p>
        </div>

        {t && (
          <div className="grid grid-cols-2 gap-3">
            <Progress label="Kits collected" orders={t.kits_collected_orders} runners={t.kits_collected_runners} totalOrders={t.orders} totalRunners={t.runners} />
            <Progress label="Checked in" orders={t.checked_in_orders} runners={t.checked_in_runners} totalOrders={t.orders} totalRunners={t.runners} />
          </div>
        )}

        <div className="bg-white rounded-2xl shadow p-4 space-y-3">
          <label htmlFor="search" className="font-bold text-slate-900 block">
            Lost QR? Search
          </label>
          <input
            id="search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Order no., group, buyer or runner name"
            className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg text-lg focus:outline-none focus:border-orange-500"
            autoComplete="off"
          />
          {error && <p className="text-red-600 font-semibold">{error}</p>}
          <p className="text-sm text-slate-500">
            {loading ? 'Searching…' : data ? `${data.results.length} result(s)${q ? '' : ' (all paid registrations)'}` : ''}
          </p>

          <ul className="divide-y divide-slate-100">
            {data?.results.map((r) => (
              <li key={r.order_no}>
                <button
                  onClick={() => navigate(`/checkin/${r.order_no}`)}
                  className="w-full text-left py-3 flex items-center justify-between gap-3 hover:bg-slate-50 rounded-lg px-1"
                >
                  <span>
                    <span className="font-mono font-black text-slate-900">{r.order_no}</span>{' '}
                    <span className="font-bold text-slate-800">{r.group_name || r.buyer_name}</span>
                    <span className="block text-sm text-slate-500">
                      {r.participant_count} runner{r.participant_count === 1 ? '' : 's'} · {r.race_category} · by {r.buyer_name}
                      {r.matched_member && ` · includes ${r.matched_member}`}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1 shrink-0 text-xs font-bold">
                    {r.status !== 'paid' ? (
                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{r.status}</span>
                    ) : (
                      <>
                        <span className={`px-2 py-0.5 rounded-full ${r.kit_collected ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                          {r.kit_collected ? '✓ Kit' : 'Kit'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full ${r.checked_in ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                          {r.checked_in ? '✓ In' : 'Check-in'}
                        </span>
                      </>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <Link to="/manage-events" className="block text-center text-orange-600 font-bold py-2">
          ← My Events
        </Link>
      </div>
    </div>
  );
}

function Progress({ label, orders, runners, totalOrders, totalRunners }) {
  const pct = totalRunners ? Math.round((runners / totalRunners) * 100) : 0;
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-black text-slate-900">
        {runners}
        <span className="text-base text-slate-500"> / {totalRunners} runners</span>
      </p>
      <p className="text-sm text-slate-600">
        {orders} of {totalOrders} registrations
      </p>
      <div className="h-2 bg-slate-200 rounded-full mt-2 overflow-hidden">
        <div className="h-full bg-green-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
