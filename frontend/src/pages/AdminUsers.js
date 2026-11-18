import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiClient from '../utils/apiClient';
import { useAuth } from '../context/AuthContext';
import OrganizerRequests from '../components/admin/OrganizerRequests';

// Admin only: find users and make them organizers (or back to participants).
// Changes apply immediately; the user gets an email.
const ROLE_BADGE = {
  participant: 'bg-slate-100 text-slate-700',
  organizer: 'bg-orange-100 text-orange-800',
  admin: 'bg-slate-900 text-white',
};

export default function AdminUsers() {
  const { user: me } = useAuth();
  // ?tab=requests opens the organizer requests (link in the admin's email).
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'requests' ? 'requests' : 'users';
  const [pendingCount, setPendingCount] = useState(0);
  useEffect(() => {
    apiClient
      .get('/admin/organizer-requests', { params: { status: 'pending' } })
      .then((res) => setPendingCount(res.data.pending_count))
      .catch(() => {});
  }, []);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/admin/users', {
        params: { q: q.trim() || undefined, role: role || undefined, page },
      });
      setData(res.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users');
    }
  }, [q, role, page]);

  // Debounced so typing in the search box doesn't send a request per key.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const changeRole = async (u, newRole) => {
    const warning =
      newRole === 'participant' && u.event_count > 0
        ? `\n\n${u.name} owns ${u.event_count} event(s). The events stay, but ${u.name} will no longer be able to manage them.`
        : '';
    const verb = newRole === 'organizer' ? 'Make' : 'Change';
    if (
      !window.confirm(
        `${verb} ${u.name} (${u.email}) ${newRole === 'organizer' ? 'an organizer' : 'a participant'}?${warning}`,
      )
    )
      return;

    setBusyId(u._id);
    setError('');
    setNotice('');
    try {
      const res = await apiClient.patch(`/admin/users/${u._id}/role`, { role: newRole });
      setNotice(res.data.message);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change the role');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-gradient-to-b from-slate-50 via-white to-orange-50 min-h-screen py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Users</h1>
          <p className="text-slate-600">
            Everyone signs up as a participant. Approve organizer requests, or make someone an organizer directly.
          </p>
        </div>

        <div className="grid grid-cols-2 bg-slate-200 rounded-2xl p-1" role="tablist">
          {[
            ['users', 'All users'],
            ['requests', `Requests${pendingCount ? ` (${pendingCount})` : ''}`],
          ].map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setSearchParams(key === 'requests' ? { tab: 'requests' } : {})}
              className={`py-3 rounded-xl font-black ${tab === key ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'requests' ? (
          <OrganizerRequests onCountChange={setPendingCount} />
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow p-4 flex flex-col sm:flex-row gap-3">
              <input
                type="search"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Search name or email"
                aria-label="Search users"
                className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500"
              />
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by role"
                className="px-4 py-3 border-2 border-slate-200 rounded-lg bg-white"
              >
                <option value="">All roles</option>
                <option value="participant">Participants</option>
                <option value="organizer">Organizers</option>
                <option value="admin">Admins</option>
              </select>
            </div>

            {error && (
              <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg font-semibold">
                {error}
              </div>
            )}
            {notice && (
              <div className="bg-green-100 border-l-4 border-green-500 text-green-800 p-4 rounded-lg font-semibold">
                {notice}
              </div>
            )}

            {data && (
              <div className="bg-white rounded-2xl shadow">
                <p className="px-5 pt-4 text-sm text-slate-500">{data.total} user(s)</p>
                <ul className="divide-y divide-slate-100">
                  {data.users.map((u) => {
                    const isMe = String(u._id) === String(me?.id || me?._id);
                    return (
                      <li key={u._id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-bold text-slate-900">
                            {u.name} {isMe && <span className="text-slate-500 font-normal">(you)</span>}
                          </p>
                          <p className="text-sm text-slate-500">
                            {u.email}
                            {u.event_count > 0 && ` · ${u.event_count} event(s)`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${ROLE_BADGE[u.role]}`}>
                            {u.role}
                          </span>
                          {u.role === 'participant' && (
                            <button
                              onClick={() => changeRole(u, 'organizer')}
                              disabled={busyId === u._id}
                              className="bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50"
                            >
                              Make organizer
                            </button>
                          )}
                          {u.role === 'organizer' && (
                            <button
                              onClick={() => changeRole(u, 'participant')}
                              disabled={busyId === u._id}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2 px-4 rounded-lg disabled:opacity-50"
                            >
                              Make participant
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                  {data.users.length === 0 && <li className="px-5 py-8 text-center text-slate-500">No users found</li>}
                </ul>
                {data.pages > 1 && (
                  <div className="flex justify-between items-center px-5 py-4 border-t border-slate-100">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="font-bold text-orange-600 disabled:opacity-30"
                    >
                      ← Previous
                    </button>
                    <span className="text-sm text-slate-500">
                      Page {data.page} of {data.pages}
                    </span>
                    <button
                      disabled={page >= data.pages}
                      onClick={() => setPage((p) => p + 1)}
                      className="font-bold text-orange-600 disabled:opacity-30"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
