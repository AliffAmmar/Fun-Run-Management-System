import React, { useCallback, useEffect, useState } from 'react';
import apiClient from '../../utils/apiClient';

// Admin: review "Request organizer access". Approve = the user becomes an organizer immediately.
const fmt = (d) =>
  new Date(d).toLocaleString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function OrganizerRequests({ onCountChange }) {
  const [status, setStatus] = useState('pending');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null); // request id
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/admin/organizer-requests', { params: { status } });
      setData(res.data);
      onCountChange?.(res.data.pending_count);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load requests');
    }
  }, [status, onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (r, action) => {
    setBusyId(r._id);
    setError('');
    setNotice('');
    try {
      const res = await apiClient.post(
        `/admin/organizer-requests/${r._id}/${action}`,
        action === 'reject' ? { reason } : {},
      );
      setNotice(res.data.message);
      setRejecting(null);
      setReason('');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[
          ['pending', 'Waiting'],
          ['approved', 'Approved'],
          ['rejected', 'Declined'],
        ].map(([v, label]) => (
          <button
            key={v}
            onClick={() => setStatus(v)}
            className={`px-4 py-2 rounded-full text-sm font-bold ${status === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 shadow'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg font-semibold">{error}</div>
      )}
      {notice && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-800 p-4 rounded-lg font-semibold">
          {notice}
        </div>
      )}

      {data && (
        <ul className="space-y-3">
          {data.requests.length === 0 && (
            <li className="bg-white rounded-2xl shadow p-8 text-center text-slate-500">
              {status === 'pending' ? 'No requests waiting' : 'Nothing here yet'}
            </li>
          )}
          {data.requests.map((r) => (
            <li key={r._id} className="bg-white rounded-2xl shadow p-5 space-y-3">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-black text-slate-900">{r.user?.name || '(deleted user)'}</p>
                  <p className="text-sm text-slate-500">
                    {r.user?.email}
                    {r.user?.phone_no && ` · ${r.user.phone_no}`}
                  </p>
                </div>
                <p className="text-xs text-slate-500">{fmt(r.createdAt)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="font-bold text-slate-800">{r.organization}</p>
                {r.note && <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{r.note}</p>}
              </div>

              {status !== 'pending' && (
                <p className="text-sm text-slate-600">
                  {status === 'approved' ? 'Approved' : 'Declined'}
                  {r.decided_by && ` by ${r.decided_by}`}
                  {r.decided_at && ` · ${fmt(r.decided_at)}`}
                  {r.decision_reason && ` · "${r.decision_reason}"`}
                </p>
              )}

              {status === 'pending' &&
                (rejecting === r._id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      decide(r, 'reject');
                    }}
                    className="space-y-2"
                  >
                    <label htmlFor={`reason-${r._id}`} className="block text-sm font-bold text-slate-700">
                      Reason (optional, shown to the user)
                    </label>
                    <textarea
                      id={`reason-${r._id}`}
                      rows={2}
                      maxLength={500}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full border-2 border-slate-200 rounded-lg p-3 focus:outline-none focus:border-orange-500"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={busyId === r._id}
                        className="bg-slate-900 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50"
                      >
                        Decline request
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejecting(null)}
                        className="bg-slate-100 font-bold py-2 px-4 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => decide(r, 'approve')}
                      disabled={busyId === r._id}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-5 rounded-lg disabled:opacity-50"
                    >
                      Approve: make organizer
                    </button>
                    <button
                      onClick={() => {
                        setRejecting(r._id);
                        setReason('');
                      }}
                      disabled={busyId === r._id}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2 px-5 rounded-lg"
                    >
                      Decline
                    </button>
                  </div>
                ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
