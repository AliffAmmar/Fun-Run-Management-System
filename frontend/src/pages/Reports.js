import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../utils/apiClient';

const formatCurrency = (amount) => `RM ${Number(amount || 0).toFixed(2)}`;

export default function Reports() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get('/reports/overview');
        setEvents(response.data.events || []);
        setError('');
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load event reports');
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-orange-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 border-b border-orange-200 pb-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-orange-700">Event performance</p>
          <h1 className="text-3xl font-black text-slate-900 sm:text-4xl">Reports</h1>
          <p className="mt-2 text-slate-600">Live participation and revenue across events you can access.</p>
        </header>

        {error && (
          <div role="alert" className="mb-6 rounded-lg border-l-4 border-red-500 bg-red-50 px-5 py-4 font-medium text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-slate-600">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" />
            Loading reports...
          </div>
        ) : events.length === 0 ? (
          <div className="border-y border-slate-200 bg-white px-6 py-14 text-center">
            <h2 className="text-xl font-bold text-slate-900">No events to report</h2>
            <p className="mt-2 text-slate-600">Events you organize will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 border-y border-slate-200">
            {events.map((event) => (
              <article key={event._id} className="grid gap-5 bg-white px-5 py-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-7">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{event.event_name}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {event.date ? new Date(event.date).toLocaleDateString() : 'Date not set'}
                    {event.location ? ` · ${event.location}` : ''}
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-4 sm:max-w-lg">
                    <div className="border-l-2 border-orange-500 pl-3">
                      <p className="text-xs font-bold uppercase text-slate-500">Participants</p>
                      <p className="mt-1 text-2xl font-black text-slate-900">{event.total_participants || 0}</p>
                    </div>
                    <div className="border-l-2 border-red-500 pl-3">
                      <p className="text-xs font-bold uppercase text-slate-500">Revenue</p>
                      <p className="mt-1 text-2xl font-black text-slate-900">{formatCurrency(event.total_revenue)}</p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/reports/${event._id}`)}
                  className="w-full rounded-lg bg-gradient-to-r from-orange-500 to-red-600 px-6 py-3 font-bold text-white transition hover:from-orange-600 hover:to-red-700 sm:w-auto"
                >
                  View Report
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}