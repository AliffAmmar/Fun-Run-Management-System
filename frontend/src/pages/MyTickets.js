import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../utils/apiClient';
import OrderCard, { displayStatus } from '../components/tickets/OrderCard';
import QrModal from '../components/tickets/QrModal';

// The buyer's registrations (orders): one card + one QR per order.
// /my-tickets?order=FR-1012 scrolls to and highlights that order (used when a buyer opens their
// own check-in QR link).
export default function MyTickets() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusOrder = searchParams.get('order');

  const [orders, setOrders] = useState([]);
  const [paymentMode, setPaymentMode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qrOrder, setQrOrder] = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/orders/my-orders');
      setOrders(res.data.orders);
      setError('');
    } catch (err) {
      setError('Failed to load your tickets');
    } finally {
      setLoading(false);
      setNow(new Date());
    }
  }, []);

  useEffect(() => {
    load();
    apiClient
      .get('/payments/config')
      .then((res) => setPaymentMode(res.data.mode))
      .catch(() => setPaymentMode(null));
  }, [load]);

  // Keep "held for N minutes" and expiry up to date.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!loading && focusOrder) document.getElementById(focusOrder)?.scrollIntoView({ behavior: 'smooth' });
  }, [loading, focusOrder]);

  const isPast = (o) => o.event_id?.date && new Date(o.event_id.date) < now;
  const sections = [
    {
      title: 'Awaiting payment',
      items: orders.filter((o) => displayStatus(o, now) === 'pending'),
    },
    {
      title: 'Upcoming',
      items: orders
        .filter((o) => displayStatus(o, now) === 'paid' && !isPast(o))
        .sort((a, b) => new Date(a.event_id?.date) - new Date(b.event_id?.date)),
    },
    {
      title: 'Past events',
      items: orders.filter((o) => displayStatus(o, now) === 'paid' && isPast(o)),
    },
  ];
  const inactive = orders.filter((o) => ['expired', 'cancelled'].includes(displayStatus(o, now)));
  const hasActive = sections.some((s) => s.items.length > 0);

  return (
    <div className="bg-gradient-to-b from-slate-50 via-white to-orange-50 min-h-screen py-8 sm:py-12 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 mb-2">My Tickets</h1>
          <p className="text-slate-600">Your registrations, bib numbers and QR codes for kit collection</p>
        </div>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 px-6 py-4 rounded-lg mb-8 font-semibold">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600 font-semibold">Loading your tickets...</p>
          </div>
        ) : !hasActive && inactive.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-10 text-center border-t-4 border-orange-500">
            <p className="text-2xl text-slate-900 font-bold mb-2">No tickets yet</p>
            <p className="text-slate-600 mb-8">Register for an event to get your QR code</p>
            <button
              onClick={() => navigate('/events')}
              className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-3 px-8 rounded-full shadow-lg uppercase tracking-wide"
            >
              Browse Events
            </button>
          </div>
        ) : (
          <div className="space-y-10">
            {sections
              .filter((s) => s.items.length > 0)
              .map((s) => (
                <section key={s.title}>
                  <h2 className="text-lg font-black text-slate-700 uppercase tracking-wide mb-4">{s.title}</h2>
                  <div className="space-y-6">
                    {s.items.map((o) => (
                      <OrderCard
                        key={o._id}
                        order={o}
                        now={now}
                        paymentMode={paymentMode}
                        highlighted={o.order_no === focusOrder}
                        onShowQr={() => setQrOrder(o)}
                        onChanged={load}
                      />
                    ))}
                  </div>
                </section>
              ))}

            {inactive.length > 0 && (
              <section>
                <button
                  onClick={() => setShowInactive((v) => !v)}
                  className="text-slate-600 font-bold hover:text-slate-900"
                >
                  {showInactive ? '▾' : '▸'} Expired & cancelled ({inactive.length})
                </button>
                {showInactive && (
                  <div className="space-y-6 mt-4">
                    {inactive.map((o) => (
                      <OrderCard
                        key={o._id}
                        order={o}
                        now={now}
                        paymentMode={paymentMode}
                        highlighted={o.order_no === focusOrder}
                        onShowQr={() => {}}
                        onChanged={load}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>

      {qrOrder && <QrModal order={qrOrder} onClose={() => setQrOrder(null)} />}
    </div>
  );
}
