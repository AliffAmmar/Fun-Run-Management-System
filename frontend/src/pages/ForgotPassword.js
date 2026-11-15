import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../utils/apiClient';
import AuthCard, { inputClass, labelClass, buttonClass } from '../components/auth/AuthCard';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post('/auth/forgot-password', { email });
      setSent(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Forgot password" subtitle="We'll email you a link to choose a new one">
      {sent ? (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-800 p-4 rounded-lg font-semibold">{sent}</div>
      ) : (
        <form onSubmit={submit} className="space-y-6">
          {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg font-semibold">{error}</div>}
          <div>
            <label htmlFor="email" className={labelClass}>
              Email address
            </label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" />
          </div>
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
      <p className="text-center">
        <Link to="/login" className="font-semibold text-orange-600 hover:text-orange-700">
          ← Back to login
        </Link>
      </p>
    </AuthCard>
  );
}
