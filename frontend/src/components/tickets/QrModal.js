import React, { useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { checkinUrl } from '../../utils/links';

// Full-screen QR for scanning at the kit counter: big, black on white, nothing else around it.
export default function QrModal({ order, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`QR code for ${order.order_no}`}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 text-center"
    >
      <p className="text-slate-500 font-semibold mb-1">{order.event_id?.event_name}</p>
      <p className="text-3xl font-black text-slate-900 mb-6">{order.order_no}</p>
      <QRCodeSVG value={checkinUrl(order.order_no)} size={320} level="M" includeMargin style={{ width: 'min(80vw, 60vh)', height: 'auto' }} />
      <p className="mt-6 text-slate-700 font-semibold">
        {order.type === 'group'
          ? `${order.group_name} · ${order.participant_count} runners`
          : order.participants?.[0]?.name}
      </p>
      <p className="mt-2 text-sm text-slate-500">Turn up your screen brightness. Tap anywhere to close.</p>
    </div>
  );
}
