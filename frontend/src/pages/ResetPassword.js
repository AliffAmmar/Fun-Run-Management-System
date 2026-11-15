import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import apiClient from '../utils/apiClient';
import AuthCard, { inputClass, labelClass, buttonClass } from '../components/auth/AuthCard';

const MIN_LENGTH = 6;

export default function ResetPassword() {
  const { token } = useParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < MIN_LENGTH) return setError(`Password must be at least ${MIN_LENGTH} characters`);
    if (password !== confirm) return setError('The two passwords do not match');
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/reset-password', { token, password });
      setDone(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
    return undefined;
  };

  return (
    <AuthCard title="Choose a new password">
      {done ? (
        <>
          <div className="bg-green-100 border-l-4 border-green-500 text-green-800 p-4 rounded-lg font-semibold">{done}</div>
          <Link to="/login" className={`block text-center ${buttonClass}`}>
            Log in
          </Link>
        </>
      ) : (
        <form onSubmit={submit} className="space-y-6">
          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg font-semibold">
              {error}
              {/expired|invalid/i.test(error) && (
                <Link to="/forgot-password" className="block mt-2 underline">
                  Request a new link
                </Link>
              )}
            </div>
          )}
          <div>
            <label htmlFor="password" className={labelClass}>
              New password
            </label>
            <input id="password" type="password" required minLength={MIN_LENGTH} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} autoComplete="new-password" />
          </div>
          <div>
            <label htmlFor="confirm" className={labelClass}>
              Repeat new password
            </label>
            <input id="confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} autoComplete="new-password" />
          </div>
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      )}
    </AuthCard>
  );
}
