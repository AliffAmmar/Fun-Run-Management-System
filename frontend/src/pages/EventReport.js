import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import apiClient from '../utils/apiClient';

const formatCurrency = (amount) => `RM ${Number(amount || 0).toFixed(2)}`;
const formatPercent = (ratio) => `${(Number(ratio || 0) * 100).toFixed(1)}%`;

const Stat = ({ label, value, detail, accent = 'border-orange-500' }) => (
  <div className={`border-l-4 ${accent} bg-white px-5 py-4 shadow-sm`}>
    <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
    <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
    {detail && <p className="mt-1 text-sm text-slate-500">{detail}</p>}
  </div>
);

const BreakdownTable = ({ title, headers, rows, emptyMessage }) => (
  <section className="min-w-0 border-y border-slate-200 bg-white">
    <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
      <h2 className="font-bold text-slate-900">{title}</h2>
    </div>
    {rows.length === 0 ? (
      <p className="px-5 py-6 text-sm text-slate-500">{emptyMessage}</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[380px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{headers.map((header) => <th key={header} className="px-5 py-3 font-bold">{header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.key}>
                {row.cells.map((cell, index) => <td key={`${row.key}-${index}`} className="px-5 py-3 text-slate-700">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

export default function EventReport() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadReport = async () => {
      try {
        setLoading(true);
        setError('');
        const [summaryResponse, historyResponse] = await Promise.all([
          apiClient.get(`/reports/event/${eventId}/summary`),
          apiClient.get(`/reports/event/${eventId}/history`),
        ]);
        setEvent(summaryResponse.data.event);
        setMetrics(summaryResponse.data.metrics);
        setHistory(historyResponse.data.reports || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load this event report');
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [eventId]);

  const exportReport = async (format) => {
    try {
      setExporting(format);
      setError('');
      setSuccess('');
      const response = await apiClient.post(
        `/reports/event/${eventId}/export`,
        { format },
        { responseType: 'blob' }
      );
      const disposition = response.headers['content-disposition'] || '';
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
      const filename = filenameMatch?.[1] || `event-report-${eventId}.${format}`;
      const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);
      setSuccess(`${format.toUpperCase()} report downloaded`);
      const historyResponse = await apiClient.get(`/reports/event/${eventId}/history`);
      setHistory(historyResponse.data.reports || []);
    } catch (err) {
      setError(err.response?.data?.message || `Failed to export ${format.toUpperCase()} report`);
    } finally {
      setExporting('');
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-16 text-center text-slate-600">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" />
        Loading event report...
      </main>
    );
  }

  if (error && !metrics) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <Link to="/reports" className="font-semibold text-orange-700 hover:text-red-700">← All reports</Link>
          <div role="alert" className="mt-6 rounded-lg border-l-4 border-red-500 bg-red-50 px-5 py-4 text-red-800">{error}</div>
        </div>
      </main>
    );
  }

  const categoryRows = Object.entries(metrics?.breakdowns?.by_race_category || {}).map(([name, value]) => ({
    key: name,
    cells: [name, value.capacity ? `${value.participants} / ${value.capacity}` : value.participants, formatCurrency(value.revenue)],
  }));
  const shirtRows = Object.entries(metrics?.breakdowns?.by_shirt_size || {}).map(([size, count]) => ({
    key: size,
    cells: [size, count],
  }));
  const paymentRows = Object.entries(metrics?.breakdowns?.by_payment_method || {}).map(([method, value]) => ({
    key: method,
    cells: [method.replaceAll('_', ' '), value.payments, formatCurrency(value.amount),
      Object.entries(value.status_counts || {}).map(([status, count]) => `${status}: ${count}`).join(', ') || '—'],
  }));
  const dailyRows = metrics?.breakdowns?.registrations_per_day || [];
  const maxDailyRegistrations = Math.max(1, ...dailyRows.map((day) => day.count));

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-orange-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <Link to="/reports" className="text-sm font-bold text-orange-700 hover:text-red-700">← All reports</Link>
        <header className="mb-7 mt-4 flex flex-col gap-5 border-b border-orange-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-orange-700">Live event report</p>
            <h1 className="text-3xl font-black text-slate-900 sm:text-4xl">{event?.event_name}</h1>
            <p className="mt-2 text-slate-600">{event?.date ? new Date(event.date).toLocaleDateString() : ''}{event?.location ? ` · ${event.location}` : ''}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={!!exporting} onClick={() => exportReport('csv')} className="rounded-lg border-2 border-orange-600 px-5 py-2.5 font-bold text-orange-700 transition hover:bg-orange-50 disabled:cursor-wait disabled:opacity-60">
              {exporting === 'csv' ? 'Preparing CSV...' : 'Export CSV'}
            </button>
            <button type="button" disabled={!!exporting} onClick={() => exportReport('pdf')} className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 px-5 py-2.5 font-bold text-white transition hover:from-orange-600 hover:to-red-700 disabled:cursor-wait disabled:opacity-60">
              {exporting === 'pdf' ? 'Preparing PDF...' : 'Export PDF'}
            </button>
          </div>
        </header>

        {error && <div role="alert" className="mb-5 rounded-lg border-l-4 border-red-500 bg-red-50 px-5 py-4 text-red-800">{error}</div>}
        {success && <div role="status" className="mb-5 rounded-lg border-l-4 border-green-500 bg-green-50 px-5 py-4 text-green-800">{success}</div>}

        <section aria-label="Event statistics" className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label="Participants" value={metrics.total_participants} detail={`${metrics.registration_count} registrations`} />
          <Stat label="Revenue" value={formatCurrency(metrics.total_revenue)} accent="border-red-500" />
          <Stat label="Capacity used" value={formatPercent(metrics.capacity_utilization)} detail={`${event?.capacity || 0} capacity`} accent="border-amber-500" />
          <Stat label="Attendance rate" value={formatPercent(metrics.attendance_rate)} detail={`${metrics.checked_in_participants} checked in`} accent="border-green-600" />
          <Stat label="Kits collected" value={formatPercent(metrics.kit_collection_rate || 0)} detail={`${metrics.kit_collected_participants || 0} runners`} accent="border-blue-500" />
        </section>

        <div className="grid gap-8 xl:grid-cols-2">
          <BreakdownTable title="Race category" headers={['Category', 'Participants / capacity', 'Revenue']} rows={categoryRows} emptyMessage="No category data yet." />
          <BreakdownTable title="Shirt sizes" headers={['Size', 'Participants']} rows={shirtRows} emptyMessage="No confirmed shirt-size data yet." />
          <BreakdownTable title="Payment methods" headers={['Method', 'Payments', 'Successful amount', 'Statuses']} rows={paymentRows} emptyMessage="No payment data yet." />

          <section className="border-y border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-bold text-slate-900">Registrations per day</h2>
            </div>
            {dailyRows.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">No registrations yet.</p>
            ) : (
              <div className="space-y-4 px-5 py-5">
                {dailyRows.map((day) => (
                  <div key={day.date} className="grid grid-cols-[6rem_minmax(0,1fr)_2rem] items-center gap-3 text-sm">
                    <span className="text-slate-600">{new Date(`${day.date}T00:00:00`).toLocaleDateString()}</span>
                    <div className="h-5 overflow-hidden bg-slate-100">
                      <div className="h-full min-w-1 bg-gradient-to-r from-orange-500 to-red-500" style={{ width: `${(day.count / maxDailyRegistrations) * 100}%` }} />
                    </div>
                    <span className="text-right font-bold text-slate-900">{day.count}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="mt-10 border-y border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-bold text-slate-900">Export history</h2>
          </div>
          {history.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">No reports have been exported for this event.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {history.map((report) => (
                <div key={report._id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{report.export_file}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {new Date(report.createdAt).toLocaleString()}
                      {report.generated_by?.name ? ` · ${report.generated_by.name}` : ''}
                    </p>
                  </div>
                  <span className="w-fit rounded border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-bold uppercase text-orange-800">{report.export_format}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}