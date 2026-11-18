import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../utils/apiClient';
import { useAuth } from '../context/AuthContext';

const MIN_PASSWORD = 6;
const ROLE = {
  participant: ['Participant', 'bg-slate-100 text-slate-700'],
  organizer: ['Organizer', 'bg-orange-100 text-orange-800'],
  admin: ['Admin', 'bg-slate-900 text-white'],
};
const card = 'bg-white rounded-2xl shadow-lg p-5 sm:p-6 space-y-4';
const label = 'block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide';
const input = 'w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 transition';
const primary =
  'bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-3 px-6 rounded-lg shadow disabled:opacity-50';

function Alert({ ok, error }) {
  if (error) return <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 rounded-lg font-semibold">{error}</div>;
  if (ok) return <div className="bg-green-100 border-l-4 border-green-500 text-green-800 p-3 rounded-lg font-semibold">{ok}</div>;
  return null;
}

export default function Profile() {
  const { updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: '', phone_no: '' });
  const [saveMsg, setSaveMsg] = useState({});
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState({});
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    apiClient
      .get('/auth/profile')
      .then((res) => {
        setProfile(res.data.user);
        setForm({ name: res.data.user.name || '', phone_no: res.data.user.phone_no || '' });
      })
      .catch(() => setSaveMsg({ error: 'Failed to load your profile' }));
  }, []);

  const saveDetails = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg({});
    try {
      const res = await apiClient.put('/auth/profile', form);
      setProfile(res.data.user);
      updateUser(res.data.user);
      setSaveMsg({ ok: 'Saved' });
    } catch (err) {
      setSaveMsg({ error: err.response?.data?.message || 'Could not save' });
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwMsg({});
    if (pw.new_password.length < MIN_PASSWORD) return setPwMsg({ error: `New password must be at least ${MIN_PASSWORD} characters` });
    if (pw.new_password !== pw.confirm) return setPwMsg({ error: 'The two new passwords do not match' });
    setChanging(true);
    try {
      await apiClient.put('/auth/password', { current_password: pw.current_password, new_password: pw.new_password });
      setPw({ current_password: '', new_password: '', confirm: '' });
      setPwMsg({ ok: 'Password changed' });
    } catch (err) {
      setPwMsg({ error: err.response?.data?.message || 'Could not change password' });
    } finally {
      setChanging(false);
    }
    return undefined;
  };

  if (!profile) {
    return (
      <Page>
        <Alert error={saveMsg.error} />
        {!saveMsg.error && <p className="text-slate-600 font-semibold">Loading…</p>}
      </Page>
    );
  }

  const [roleLabel, roleClass] = ROLE[profile.role] || ROLE.participant;
  const dirty = form.name.trim() !== (profile.name || '') || form.phone_no.trim() !== (profile.phone_no || '');

  return (
    <Page>
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-2xl font-black">
          {profile.name?.charAt(0)}
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">{profile.name}</h1>
          <p className="text-slate-600 flex flex-wrap items-center gap-2">
            <span className={`px-3 py-0.5 rounded-full text-xs font-bold uppercase ${roleClass}`}>{roleLabel}</span>
            {profile.createdAt && (
              <span className="text-sm">
                Member since {new Date(profile.createdAt).toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Shortcuts */}
      <section className={card}>
        <h2 className="text-lg font-black text-slate-900">Quick links</h2>
        <div className="flex flex-wrap gap-2">
          {profile.role !== 'organizer' && <Shortcut to="/my-tickets">My Tickets</Shortcut>}
          {profile.role === 'organizer' && <Shortcut to="/manage-events">My Events</Shortcut>}
          {['organizer', 'admin'].includes(profile.role) && <Shortcut to="/event-day">Event Day</Shortcut>}
          {['organizer', 'admin'].includes(profile.role) && <Shortcut to="/reports">Reports</Shortcut>}
          {profile.role === 'admin' && <Shortcut to="/admin/users">Users</Shortcut>}
          <Shortcut to="/events">Browse events</Shortcut>
        </div>
        {profile.role === 'participant' && (
          <p className="text-sm text-slate-600">Want to organise a run? Ask the Run4Fun admin to make your account an organizer.</p>
        )}
      </section>

      {/* Details */}
      <section className={card}>
        <h2 className="text-lg font-black text-slate-900">Your details</h2>
        <form onSubmit={saveDetails} className="space-y-4">
          <Alert {...saveMsg} />
          <div>
            <label htmlFor="name" className={label}>
              Full name
            </label>
            <input id="name" required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
            <p className="text-sm text-slate-500 mt-1">Use your full name as it should appear on certificates. It's pre-filled when you register.</p>
          </div>
          <div>
            <label htmlFor="email" className={label}>
              Email
            </label>
            <input id="email" value={profile.email} disabled className={`${input} bg-slate-100 text-slate-500`} />
            <p className="text-sm text-slate-500 mt-1">Used to log in, so it can't be changed here.</p>
          </div>
          <div>
            <label htmlFor="phone" className={label}>
              Phone number
            </label>
            <input id="phone" type="tel" value={form.phone_no} onChange={(e) => setForm({ ...form, phone_no: e.target.value })} placeholder="e.g. 012-345 6789" className={input} />
          </div>
          <button type="submit" disabled={saving || !dirty} className={primary}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </section>

      {/* Password */}
      <section className={card}>
        <h2 className="text-lg font-black text-slate-900">Change password</h2>
        <form onSubmit={changePassword} className="space-y-4">
          <Alert {...pwMsg} />
          <div>
            <label htmlFor="current_password" className={label}>
              Current password
            </label>
            <input id="current_password" type="password" required autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} className={input} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="new_password" className={label}>
                New password
              </label>
              <input id="new_password" type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} className={input} />
            </div>
            <div>
              <label htmlFor="confirm_password" className={label}>
                Repeat new password
              </label>
              <input id="confirm_password" type="password" required autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} className={input} />
            </div>
          </div>
          <button type="submit" disabled={changing} className={primary}>
            {changing ? 'Changing…' : 'Change password'}
          </button>
          <p className="text-sm text-slate-500">
            Forgot your current password? <Link to="/forgot-password" className="text-orange-600 font-semibold">Reset it by email</Link>.
          </p>
        </form>
      </section>
    </Page>
  );
}

function Shortcut({ to, children }) {
  return (
    <Link to={to} className="bg-slate-100 hover:bg-orange-100 text-slate-800 font-bold py-2 px-4 rounded-lg transition">
      {children}
    </Link>
  );
}

function Page({ children }) {
  return (
    <div className="bg-gradient-to-b from-slate-50 via-white to-orange-50 min-h-screen py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">{children}</div>
    </div>
  );
}
