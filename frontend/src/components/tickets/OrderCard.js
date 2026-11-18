import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import apiClient from '../../utils/apiClient';
import { checkinUrl } from '../../utils/links';
import { downloadFile, blobErrorMessage } from '../../utils/download';
import ShirtSizeSummary from '../registration/ShirtSizeSummary';
import EditRunners from './EditRunners';

const money = (n) => `RM ${Number(n || 0).toFixed(2)}`;
const fmtDate = (d) => new Date(d).toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtStamp = (d) =>
  new Date(d).toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// 'paid' | 'pending' | 'expired' | 'cancelled'
export const displayStatus = (o, now = new Date()) =>
  o.status === 'pending' && new Date(o.expires_at) <= now ? 'expired' : o.status;

const BADGE = {
  paid: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  expired: 'bg-slate-200 text-slate-600',
  cancelled: 'bg-slate-200 text-slate-600',
};
const BADGE_TEXT = { paid: 'Paid', pending: 'Awaiting payment', expired: 'Expired', cancelled: 'Cancelled' };

export default function OrderCard({ order, paymentMode, onShowQr, onChanged, highlighted, now }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const event = order.event_id || {};
  const status = displayStatus(order, now);
  const isGroup = order.type === 'group';
  const minutesLeft = Math.max(0, Math.ceil((new Date(order.expires_at) - now) / 60000));

  const act = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await onChanged();
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  const pay = () => act(() => apiClient.post(`/payments/orders/${order.order_no}/mock`, {}));
  const withCerts = (order.participants || []).filter((p) => p.certificate_no);
  // Kit collection / check-in are ticked per runner by staff.
  const runnerCount = order.participants?.length || order.participant_count;
  const kitCount = (order.participants || []).filter((p) => p.kit_collected).length;
  const inCount = (order.participants || []).filter((p) => p.checked_in).length;
  // Names / shirt sizes can be corrected until the kit preparation cutoff (server re-checks).
  const canEdit = ['paid', 'pending'].includes(status) && order.edit_until && now <= new Date(order.edit_until);
  const download = async (path, filename) => {
    setError('');
    try {
      await downloadFile(path, filename);
    } catch (err) {
      setError(await blobErrorMessage(err));
    }
  };
  const cancel = () => {
    if (!window.confirm(`Cancel registration ${order.order_no}? The slots will be released.`)) return;
    act(() => apiClient.delete(`/orders/${order.order_no}`));
  };

  return (
    <div
      id={order.order_no}
      className={`bg-white rounded-2xl shadow-lg overflow-hidden border-l-4 scroll-mt-24 ${
        status === 'paid' ? 'border-orange-500' : 'border-slate-300'
      } ${highlighted ? 'ring-4 ring-orange-300' : ''}`}
    >
      <div className="flex flex-col md:flex-row">
        {/* ---- Details ---- */}
        <div className="flex-1 p-5 sm:p-7 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900">{event.event_name}</h3>
              <p className="text-slate-600">
                {event.date && fmtDate(event.date)}
                {event.location && ` · ${event.location}`}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${BADGE[status]}`}>{BADGE_TEXT[status]}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Info k="Order" v={<span className="font-mono">{order.order_no}</span>} />
            <Info k="Category" v={order.race_category} />
            <Info k={isGroup ? 'Group' : 'Type'} v={isGroup ? order.group_name : 'Individual'} />
            <Info k="Total" v={money(order.total_amount)} />
          </div>

          {status === 'paid' && (
            <div className="flex flex-wrap gap-2 text-sm">
              <Stamp
                done={order.kit_collected}
                doneText={`Kit collected ${order.kit_collected_at ? fmtStamp(order.kit_collected_at) : ''}`}
                todoText={kitCount ? `Kit collected ${kitCount} of ${runnerCount}` : 'Kit not collected yet'}
              />
              <Stamp
                done={order.checked_in}
                doneText={`Checked in ${order.checked_in_at ? fmtStamp(order.checked_in_at) : ''}`}
                todoText={inCount ? `Checked in ${inCount} of ${runnerCount}` : 'Not checked in'}
              />
            </div>
          )}

          {/* Runners + bibs */}
          {isGroup ? (
            <>
              <ShirtSizeSummary counts={order.shirt_sizes || {}} />
              <details className="bg-slate-50 rounded-xl p-3">
                <summary className="font-bold text-slate-800 cursor-pointer">
                  {order.participant_count} runners{status === 'paid' ? ' & bib numbers' : ''}
                </summary>
                <ul className="mt-2 divide-y divide-slate-200 text-sm max-h-72 overflow-y-auto">
                  {order.participants?.map((p) => (
                    <li key={p._id} className="flex justify-between gap-3 py-1.5">
                      <span className="text-slate-800">
                        {p.name} <span className="text-slate-500">· {p.shirt_size}</span>
                        {p.kit_collected && <span className="text-green-700 text-xs font-bold"> · kit ✓</span>}
                        {p.checked_in && <span className="text-green-700 text-xs font-bold"> · in ✓</span>}
                      </span>
                      {p.bib_number && <span className="font-mono font-black text-orange-700">{p.bib_number}</span>}
                    </li>
                  ))}
                </ul>
              </details>
            </>
          ) : (
            order.participants?.[0] && (
              <p className="text-slate-800">
                {order.participants[0].name} · {order.participants[0].shirt_size}
                {order.participants[0].bib_number && (
                  <span className="ml-2 font-mono font-black text-orange-700">Bib {order.participants[0].bib_number}</span>
                )}
              </p>
            )
          )}

          {canEdit &&
            (editing ? (
              <EditRunners order={order} onSaved={() => onChanged()} onClose={() => setEditing(false)} />
            ) : (
              <button onClick={() => setEditing(true)} className="text-sm font-bold text-orange-600 hover:underline">
                ✎ Fix a name or shirt size
              </button>
            ))}

          {/* Certificates (after the organizer completes the event) */}
          {withCerts.length > 0 && (
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 space-y-2">
              <p className="font-bold text-green-900">🎉 Certificates are ready</p>
              {isGroup ? (
                <>
                  <button
                    onClick={() => download(`/certificates/orders/${order.order_no}/zip`, `${order.order_no}-certificates.zip`)}
                    disabled={busy}
                    className="bg-green-700 hover:bg-green-800 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50"
                  >
                    Download all ({withCerts.length}) as ZIP
                  </button>
                  <p className="text-sm text-green-900">
                    Members with an email received theirs by email. Please pass the others on.
                  </p>
                  <ul className="text-sm divide-y divide-green-100 max-h-60 overflow-y-auto">
                    {withCerts.map((p) => (
                      <li key={p._id} className="flex justify-between gap-3 py-1.5">
                        <span className="text-slate-800">
                          {p.name}
                          {!p.email && <span className="text-slate-500"> · no email</span>}
                        </span>
                        <button
                          onClick={() => download(`/certificates/${p.certificate_no}/pdf`, `${p.certificate_no}.pdf`)}
                          className="font-bold text-green-800 hover:underline"
                        >
                          PDF
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <button
                  onClick={() => download(`/certificates/${withCerts[0].certificate_no}/pdf`, `${withCerts[0].certificate_no}.pdf`)}
                  disabled={busy}
                  className="bg-green-700 hover:bg-green-800 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50"
                >
                  Download my certificate
                </button>
              )}
            </div>
          )}

          {/* Unpaid actions */}
          {status === 'pending' && (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 space-y-3">
              <p className="text-yellow-900 font-semibold">
                Slots held for {minutesLeft} more minute{minutesLeft === 1 ? '' : 's'}. Pay to confirm.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                {paymentMode === 'mock' ? (
                  <button
                    onClick={pay}
                    disabled={busy}
                    className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-3 px-5 rounded-lg shadow disabled:opacity-50"
                  >
                    {busy ? 'Processing…' : `Pay ${money(order.total_amount)} (demo)`}
                  </button>
                ) : (
                  <p className="flex-1 text-slate-600 text-sm">Online payment is not available yet.</p>
                )}
                <button
                  onClick={cancel}
                  disabled={busy}
                  className="bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-800 font-bold py-3 px-5 rounded-lg disabled:opacity-50"
                >
                  Cancel registration
                </button>
              </div>
            </div>
          )}

          {status === 'expired' && (
            <p className="text-slate-600 text-sm">
              Not paid within 30 minutes, so the slots were released.{' '}
              {event._id && (
                <Link to={`/register/${event._id}`} className="text-orange-600 font-bold hover:underline">
                  Register again
                </Link>
              )}
            </p>
          )}

          {error && <p className="text-red-600 font-semibold">{error}</p>}
        </div>

        {/* ---- QR (paid only) ---- */}
        {status === 'paid' && (
          <div className="md:w-64 bg-gradient-to-br from-slate-50 to-orange-50 p-6 flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-slate-200">
            <button onClick={onShowQr} aria-label={`Show QR code for ${order.order_no} full screen`} className="bg-white p-2 rounded-lg shadow">
              <QRCodeSVG value={checkinUrl(order.order_no)} size={176} level="M" />
            </button>
            <p className="mt-3 font-mono font-black text-lg text-slate-900">{order.order_no}</p>
            <p className="text-xs text-slate-600 text-center mt-1">
              {isGroup ? 'One QR for the whole group. Show it at kit collection.' : 'Show this at kit collection.'}
            </p>
            <button onClick={onShowQr} className="mt-3 text-orange-600 font-bold hover:underline text-sm">
              Show full screen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ k, v }) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{k}</p>
      <p className="font-bold text-slate-900 break-words">{v}</p>
    </div>
  );
}

function Stamp({ done, doneText, todoText }) {
  return (
    <span className={`px-3 py-1 rounded-full font-semibold ${done ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
      {done ? `✓ ${doneText}` : todoText}
    </span>
  );
}
