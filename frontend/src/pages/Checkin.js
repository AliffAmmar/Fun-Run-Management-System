import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import apiClient from '../utils/apiClient';
import { useAuth } from '../context/AuthContext';
import { getWorkingEventId } from '../utils/workingEvent';
import ShirtSizeSummary from '../components/registration/ShirtSizeSummary';

// Opened by scanning an order's QR (/checkin/FR-1012) on a staff phone.
// Built phone-first: big status, big buttons, little else.
const fmtStamp = (d) =>
  new Date(d).toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtTime = (d) => new Date(d).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });

const ACTION_LABEL = {
  kit_collected: 'Kit collected',
  checked_in: 'Checked in',
  undo_kit_collected: 'Undo kit collected',
  undo_checked_in: 'Undo check-in',
};

export default function Checkin() {
  const { orderNo } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null); // { status, message }
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [undoFor, setUndoFor] = useState(null); // 'collect' | 'checkin'
  const [reason, setReason] = useState('');

  const workingEventId = getWorkingEventId();
  const qs = workingEventId ? `?event_id=${workingEventId}` : '';

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get(`/checkin/${encodeURIComponent(orderNo)}${qs}`);
      setData(res.data);
      setLoadError(null);
    } catch (err) {
      const body = err.response?.data || {};
      if (body.is_buyer) {
        navigate(`/my-tickets?order=${encodeURIComponent(body.order_no)}`, { replace: true });
        return;
      }
      setLoadError({ status: err.response?.status, message: body.message || 'Could not load this registration' });
    }
  }, [orderNo, qs, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (path, body) => {
    setBusy(true);
    setActionError('');
    try {
      const res = await apiClient.post(`/checkin/${encodeURIComponent(orderNo)}/${path}${qs}`, body);
      setData(res.data);
      setUndoFor(null);
      setReason('');
    } catch (err) {
      setActionError(err.response?.data?.message || 'Something went wrong. Please try again.');
      load(); // someone else may have changed it
    } finally {
      setBusy(false);
    }
  };

  const switchAccount = () => {
    logout();
    navigate('/login', { state: { from: location.pathname + location.search } });
  };

  if (loadError) {
    return (
      <Shell>
        <div className="bg-white rounded-2xl shadow-lg p-6 text-center space-y-4">
          <p className="text-2xl font-black text-slate-900">{orderNo}</p>
          <p className="text-red-700 font-bold text-lg">{loadError.message}</p>
          {loadError.status === 403 && (
            <button onClick={switchAccount} className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg">
              Log in with the organizer account
            </button>
          )}
          <Link to="/event-day" className="block text-orange-600 font-bold">
            Go to Event Day search
          </Link>
        </div>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <div className="text-center py-16">
          <div className="w-14 h-14 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-slate-600 font-semibold">Loading {orderNo}…</p>
        </div>
      </Shell>
    );
  }

  const { order, event, buyer, participants, shirt_sizes, bib_range, valid, warnings, log } = data;
  const errors = warnings.filter((w) => w.level === 'error');
  const otherWarnings = warnings.filter((w) => w.level !== 'error');

  return (
    <Shell>
      <div className="space-y-4">
        {/* Header */}
        <div className="text-center">
          <p className="text-slate-500 font-semibold">{event.event_name}</p>
          <p className="text-4xl font-black text-slate-900 tracking-tight">{order.order_no}</p>
        </div>

        {/* Validity */}
        {valid ? (
          <div className="bg-green-600 text-white rounded-2xl p-4 text-center font-black text-xl">✓ Valid registration · Paid</div>
        ) : (
          errors.map((w) => (
            <div key={w.message} className="bg-red-600 text-white rounded-2xl p-4 text-center font-black text-xl">
              ✕ {w.message}
            </div>
          ))
        )}
        {otherWarnings.map((w) => (
          <div key={w.message} className="bg-yellow-100 border-2 border-yellow-400 text-yellow-900 rounded-2xl p-4 font-bold">
            ⚠ {w.message}
          </div>
        ))}

        {/* Who */}
        <div className="bg-white rounded-2xl shadow p-4 space-y-2">
          <p className="text-2xl font-black text-slate-900">
            {order.type === 'group' ? order.group_name : participants[0]?.name}
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat k="Runners" v={order.participant_count} />
            <Stat k="Category" v={order.race_category} />
            <Stat k="Bibs" v={bib_range || '—'} small />
          </div>
          {buyer && (
            <p className="text-slate-700 pt-1">
              <span className="text-slate-500">Registered by</span> <span className="font-bold">{buyer.name}</span>
              {buyer.phone_no && (
                <>
                  {' · '}
                  <a href={`tel:${buyer.phone_no}`} className="font-bold text-orange-700 underline">
                    {buyer.phone_no}
                  </a>
                </>
              )}
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow p-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Shirt sizes</p>
          <ShirtSizeSummary counts={shirt_sizes} />
        </div>

        {actionError && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-800 p-3 rounded-lg font-semibold">{actionError}</div>
        )}

        {/* Kit collection */}
        <ActionBlock
          done={order.kit_collected}
          doneText={`✓ Kit collected ${order.kit_collected_at ? fmtStamp(order.kit_collected_at) : ''}`}
          buttonText={order.type === 'group' ? `Mark kit collected (all ${order.participant_count})` : 'Mark kit collected'}
          disabled={!valid || busy}
          onDo={() => post('collect')}
          onUndo={() => setUndoFor('collect')}
          note={!order.kit_collected && valid ? "Verify the buyer's IC before handing over the kits." : null}
        />

        {/* Event-day check-in */}
        <ActionBlock
          done={order.checked_in}
          doneText={`✓ Checked in ${order.checked_in_at ? fmtTime(order.checked_in_at) : ''}`}
          buttonText="Mark checked in"
          disabled={!valid || busy}
          onDo={() => post('checkin')}
          onUndo={() => setUndoFor('checkin')}
          secondary
        />

        {/* Undo (needs a reason, logged) */}
        {undoFor && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              post('undo', { action: undoFor, reason });
            }}
            className="bg-white rounded-2xl shadow p-4 space-y-3 border-2 border-slate-300"
          >
            <label htmlFor="undo-reason" className="font-bold text-slate-900 block">
              Undo {undoFor === 'collect' ? 'kit collection' : 'check-in'}: why?
            </label>
            <textarea
              id="undo-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              required
              minLength={3}
              placeholder="e.g. Tapped the wrong group"
              className="w-full border-2 border-slate-200 rounded-lg p-3 focus:outline-none focus:border-orange-500"
            />
            <div className="flex gap-2">
              <button type="submit" disabled={busy || reason.trim().length < 3} className="flex-1 bg-slate-900 text-white font-bold py-3 rounded-lg disabled:opacity-50">
                Confirm undo
              </button>
              <button type="button" onClick={() => setUndoFor(null)} className="flex-1 bg-slate-100 font-bold py-3 rounded-lg">
                Keep it
              </button>
            </div>
          </form>
        )}

        {/* Members */}
        <details className="bg-white rounded-2xl shadow p-4" open={participants.length <= 10}>
          <summary className="font-bold text-slate-900 cursor-pointer">Runners ({participants.length})</summary>
          <ul className="mt-2 divide-y divide-slate-100">
            {participants.map((p) => (
              <li key={p._id} className="flex justify-between gap-3 py-2">
                <span className="text-slate-800">
                  {p.name} <span className="text-slate-500">· {p.shirt_size}</span>
                </span>
                <span className="font-mono font-black text-orange-700">{p.bib_number || '—'}</span>
              </li>
            ))}
          </ul>
        </details>

        {log.length > 0 && (
          <details className="bg-white rounded-2xl shadow p-4">
            <summary className="font-bold text-slate-900 cursor-pointer">Activity</summary>
            <ul className="mt-2 text-sm text-slate-700 space-y-1">
              {log.map((l, i) => (
                <li key={i}>
                  <span className="font-semibold">{ACTION_LABEL[l.action]}</span> · {fmtStamp(l.at)}
                  {l.by && ` · ${l.by}`}
                  {l.reason && <span className="text-slate-500"> · "{l.reason}"</span>}
                </li>
              ))}
            </ul>
          </details>
        )}

        <Link to="/event-day" className="block text-center text-orange-600 font-bold py-2">
          ← Event Day search
        </Link>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="bg-slate-100 min-h-screen py-4 px-4">
      <div className="max-w-md mx-auto">{children}</div>
    </div>
  );
}

function Stat({ k, v, small }) {
  return (
    <div className="bg-slate-50 rounded-lg py-2">
      <p className="text-xs font-bold text-slate-500 uppercase">{k}</p>
      <p className={`font-black text-slate-900 ${small ? 'text-sm' : 'text-xl'}`}>{v}</p>
    </div>
  );
}

function ActionBlock({ done, doneText, buttonText, disabled, onDo, onUndo, note, secondary }) {
  if (done) {
    return (
      <div className="bg-white rounded-2xl shadow p-4 flex items-center justify-between gap-3">
        <span className="text-green-700 font-black text-lg">{doneText}</span>
        <button onClick={onUndo} className="text-sm text-slate-500 underline shrink-0">
          Undo
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {note && <p className="bg-amber-50 border-2 border-amber-300 text-amber-900 rounded-xl p-3 font-bold text-center">{note}</p>}
      <button
        onClick={onDo}
        disabled={disabled}
        className={`w-full py-5 rounded-2xl font-black text-xl shadow-lg disabled:opacity-40 disabled:shadow-none ${
          secondary ? 'bg-slate-900 text-white' : 'bg-green-600 hover:bg-green-700 text-white'
        }`}
      >
        {buttonText}
      </button>
    </div>
  );
}
