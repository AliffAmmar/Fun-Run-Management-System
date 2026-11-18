import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import apiClient from '../utils/apiClient';
import { useAuth } from '../context/AuthContext';
import { getWorkingEventId } from '../utils/workingEvent';
import ShirtSizeSummary from '../components/registration/ShirtSizeSummary';

// Opened by scanning an order's QR (/checkin/FR-1012) on a staff phone. Phone-first.
// Staff tick each runner who collected their kit (or checked in). The group only counts as
// "collected" / "checked in" once every runner is ticked; otherwise staff can leave a remark.
const fmtStamp = (d) =>
  new Date(d).toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtTime = (d) => new Date(d).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });

const MODES = {
  collect: {
    tab: 'Kit collection',
    flag: 'kit_collected',
    at: 'kit_collected_at',
    count: 'kit_collected_count',
    remark: 'kit_remark',
    done: 'collected',
    verb: 'kit collected',
  },
  checkin: {
    tab: 'Check-in',
    flag: 'checked_in',
    at: 'checked_in_at',
    count: 'checked_in_count',
    remark: 'checkin_remark',
    done: 'checked in',
    verb: 'checked in',
  },
};
const ACTION_LABEL = {
  kit_collected: 'Kit collected',
  checked_in: 'Checked in',
  undo_kit_collected: 'Undo kit collected',
  undo_checked_in: 'Undo check-in',
  kit_remark: 'Kit remark',
  checkin_remark: 'Check-in remark',
};

export default function Checkin() {
  const { orderNo } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null); // { status, message }
  const [mode, setMode] = useState('collect');
  const [selected, setSelected] = useState(() => new Set());
  const [remark, setRemark] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [undo, setUndo] = useState(null); // { ids: [...], label }
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

  // New mode or fresh data → start with nothing selected.
  useEffect(() => {
    setSelected(new Set());
    setRemark('');
    setUndo(null);
  }, [mode, data]);

  const m = MODES[mode];
  const remaining = useMemo(() => (data ? data.participants.filter((p) => !p[m.flag]) : []), [data, m.flag]);

  const post = async (path, body) => {
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      const res = await apiClient.post(`/checkin/${encodeURIComponent(orderNo)}/${path}${qs}`, body);
      setData(res.data);
      setNotice(res.data.message || '');
      setReason('');
    } catch (err) {
      setActionError(err.response?.data?.message || 'Something went wrong. Please try again.');
      load(); // someone else may have changed it
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
  const total = participants.length;
  const doneCount = order[m.count];
  const allDone = doneCount === total;
  const selCount = selected.size;
  const leavesSomeone = selCount < remaining.length; // after saving, someone is still not ticked

  const submit = () => {
    const ids = [...selected];
    if (ids.length === 0 && remark.trim()) {
      post(mode, { participant_ids: [], remark });
    } else {
      post(mode, { participant_ids: ids, remark: remark.trim() || undefined });
    }
  };

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
          <p className="text-2xl font-black text-slate-900">{order.type === 'group' ? order.group_name : participants[0]?.name}</p>
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

        {/* Mode switch */}
        <div className="grid grid-cols-2 bg-slate-200 rounded-2xl p-1" role="tablist">
          {Object.entries(MODES).map(([key, mm]) => (
            <button
              key={key}
              role="tab"
              aria-selected={mode === key}
              onClick={() => setMode(key)}
              className={`py-3 rounded-xl font-black ${mode === key ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}
            >
              {mm.tab}
              <span className="block text-xs font-bold text-slate-500">
                {order[mm.count]}/{total}
              </span>
            </button>
          ))}
        </div>

        {notice && <div className="bg-green-100 border-l-4 border-green-500 text-green-800 p-3 rounded-lg font-semibold">{notice}</div>}
        {actionError && <div className="bg-red-100 border-l-4 border-red-500 text-red-800 p-3 rounded-lg font-semibold">{actionError}</div>}

        {/* Status for this mode */}
        <div className={`rounded-2xl p-4 font-black text-lg ${allDone ? 'bg-green-100 text-green-800' : 'bg-white shadow text-slate-900'}`}>
          {allDone
            ? `✓ All ${total} ${m.done}${order[m.at] ? ` · ${mode === 'collect' ? fmtStamp(order[m.at]) : fmtTime(order[m.at])}` : ''}`
            : `${doneCount} of ${total} ${m.done}`}
          {order[m.remark] && <p className="text-sm font-semibold text-slate-600 mt-1">Note: {order[m.remark]}</p>}
        </div>

        {mode === 'collect' && valid && remaining.length > 0 && (
          <p className="bg-amber-50 border-2 border-amber-300 text-amber-900 rounded-xl p-3 font-bold text-center">
            Verify the buyer's IC before handing over the kits.
          </p>
        )}

        {/* Runner list */}
        <div className="bg-white rounded-2xl shadow p-2">
          {valid && remaining.length > 0 && (
            <div className="flex justify-between items-center px-2 py-2">
              <span className="text-sm font-bold text-slate-600">{selCount} selected</span>
              <div className="flex gap-3">
                <button onClick={() => setSelected(new Set(remaining.map((p) => p._id)))} className="text-sm font-bold text-orange-600">
                  Select all ({remaining.length})
                </button>
                {selCount > 0 && (
                  <button onClick={() => setSelected(new Set())} className="text-sm font-bold text-slate-500">
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
          <ul className="divide-y divide-slate-100">
            {participants.map((p) => {
              const done = p[m.flag];
              return (
                <li key={p._id}>
                  {done ? (
                    <div className="flex items-center gap-3 px-2 py-3">
                      <span className="w-7 h-7 rounded-md bg-green-600 text-white flex items-center justify-center font-black">✓</span>
                      <span className="flex-1">
                        <span className="font-bold text-slate-900">{p.name}</span>
                        <span className="block text-xs text-slate-500">
                          {p.bib_number || '—'} · {p.shirt_size} · {p[m.at] ? fmtTime(p[m.at]) : ''}
                        </span>
                      </span>
                      <button onClick={() => setUndo({ ids: [p._id], label: p.name })} className="text-sm text-slate-500 underline">
                        Undo
                      </button>
                    </div>
                  ) : (
                    <label className={`flex items-center gap-3 px-2 py-3 ${valid ? 'cursor-pointer' : 'opacity-60'}`}>
                      <input
                        type="checkbox"
                        className="w-7 h-7 accent-green-600"
                        disabled={!valid}
                        checked={selected.has(p._id)}
                        onChange={() => toggle(p._id)}
                      />
                      <span className="flex-1">
                        <span className="font-bold text-slate-900">{p.name}</span>
                        <span className="block text-xs text-slate-500">
                          {p.bib_number || '—'} · {p.shirt_size}
                        </span>
                      </span>
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
          {allDone && total > 1 && (
            <button onClick={() => setUndo({ ids: participants.map((p) => p._id), label: `all ${total} runners` })} className="w-full text-sm text-slate-500 underline py-2">
              Undo for everyone
            </button>
          )}
        </div>

        {/* Save selection (+ optional remark) */}
        {valid && remaining.length > 0 && (
          <div className="bg-white rounded-2xl shadow p-4 space-y-3">
            <label htmlFor="remark" className="block font-bold text-slate-900">
              Remark (optional)
            </label>
            {leavesSomeone && (
              <p className="text-sm text-slate-600">
                {remaining.length - selCount} runner(s) will still not be {m.done}. You can add a note, e.g. who will come later.
              </p>
            )}
            <textarea
              id="remark"
              rows={2}
              maxLength={500}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder={mode === 'collect' ? 'e.g. 3 runners will collect tomorrow' : 'e.g. 2 runners have not arrived'}
              className="w-full border-2 border-slate-200 rounded-lg p-3 focus:outline-none focus:border-orange-500"
            />
            <button
              onClick={submit}
              disabled={busy || (selCount === 0 && !remark.trim())}
              className={`w-full py-5 rounded-2xl font-black text-xl shadow-lg disabled:opacity-40 disabled:shadow-none text-white ${
                mode === 'collect' ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-900'
              }`}
            >
              {busy
                ? 'Saving…'
                : selCount > 0
                  ? `Mark ${selCount} as ${m.verb}`
                  : remark.trim()
                    ? 'Save remark'
                    : `Select runners to mark as ${m.verb}`}
            </button>
          </div>
        )}

        {/* Undo (needs a reason, logged) */}
        {undo && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              post('undo', { action: mode, participant_ids: undo.ids, reason });
            }}
            className="bg-white rounded-2xl shadow p-4 space-y-3 border-2 border-slate-300"
          >
            <label htmlFor="undo-reason" className="font-bold text-slate-900 block">
              Undo {m.verb} for {undo.label}: why?
            </label>
            <textarea
              id="undo-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              required
              minLength={3}
              placeholder="e.g. Ticked the wrong runner"
              className="w-full border-2 border-slate-200 rounded-lg p-3 focus:outline-none focus:border-orange-500"
            />
            <div className="flex gap-2">
              <button type="submit" disabled={busy || reason.trim().length < 3} className="flex-1 bg-slate-900 text-white font-bold py-3 rounded-lg disabled:opacity-50">
                Confirm undo
              </button>
              <button type="button" onClick={() => setUndo(null)} className="flex-1 bg-slate-100 font-bold py-3 rounded-lg">
                Keep it
              </button>
            </div>
          </form>
        )}

        {log.length > 0 && (
          <details className="bg-white rounded-2xl shadow p-4">
            <summary className="font-bold text-slate-900 cursor-pointer">Activity</summary>
            <ul className="mt-2 text-sm text-slate-700 space-y-1">
              {log.map((l, i) => (
                <li key={i}>
                  <span className="font-semibold">{ACTION_LABEL[l.action] || l.action}</span>
                  {l.count > 0 && ` (${l.count})`} · {fmtStamp(l.at)}
                  {l.by && ` · ${l.by}`}
                  {l.reason && <span className="text-slate-500"> · "{l.reason}"</span>}
                  {l.remark && <span className="text-slate-500"> · Note: "{l.remark}"</span>}
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
