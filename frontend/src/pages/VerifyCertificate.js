import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '../utils/apiClient';

// Public page opened by scanning the QR on a certificate. Shows only name, category and event.
export default function VerifyCertificate() {
  const { certificateNo } = useParams();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    apiClient
      .get(`/certificates/verify/${encodeURIComponent(certificateNo)}`)
      .then((res) => setState({ data: res.data }))
      .catch((err) =>
        setState({ invalid: err.response?.status === 404, error: err.response?.status !== 404 })
      );
  }, [certificateNo]);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden text-center">
        <div className="bg-gradient-to-r from-slate-900 via-red-700 to-orange-600 text-white p-5">
          <p className="text-xs uppercase tracking-widest opacity-80">Run4Fun</p>
          <p className="text-xl font-black">Certificate verification</p>
        </div>
        <div className="p-6 space-y-4">
          <p className="font-mono font-bold text-slate-700">{certificateNo}</p>
          {state.loading && <p className="text-slate-500">Checking…</p>}
          {state.data && (
            <>
              <div className="bg-green-600 text-white rounded-xl p-4 font-black text-xl">✓ Valid certificate</div>
              <p className="text-2xl font-black text-slate-900">{state.data.name}</p>
              <p className="text-slate-700">
                took part in the <b>{state.data.race_category}</b> run of
              </p>
              <p className="text-lg font-bold text-slate-900">{state.data.event_name}</p>
              <p className="text-slate-500">{new Date(state.data.event_date).toLocaleDateString('en-MY', { dateStyle: 'long' })}</p>
            </>
          )}
          {state.invalid && (
            <div className="bg-red-600 text-white rounded-xl p-4 font-black text-lg">✕ No certificate with this number</div>
          )}
          {state.error && <p className="text-red-700 font-semibold">Could not check right now. Please try again later.</p>}
        </div>
      </div>
    </div>
  );
}
