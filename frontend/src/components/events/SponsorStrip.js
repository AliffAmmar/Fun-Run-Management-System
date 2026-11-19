import React, { useEffect, useState } from 'react';
import apiClient from '../../utils/apiClient';
import { imageSrc } from '../../utils/eventImages';

// Public "Sponsored by" section on the event page: confirmed + visible sponsors, grouped by the
// organizer's tiers, top tier first with the biggest logos.
const SIZES = ['h-20', 'h-14', 'h-10']; // logo height by tier position

export default function SponsorStrip({ eventId }) {
  const [sponsors, setSponsors] = useState([]);

  useEffect(() => {
    apiClient
      .get(`/events/${eventId}/sponsors`)
      .then((res) => setSponsors(res.data.sponsors || []))
      .catch(() => setSponsors([]));
  }, [eventId]);

  if (sponsors.length === 0) return null;

  const tiers = [];
  sponsors.forEach((s) => {
    let t = tiers.find((x) => x.name === s.tier);
    if (!t) tiers.push((t = { name: s.tier, list: [] }));
    t.list.push(s);
  });

  return (
    <div className="mb-10">
      <h2 className="text-2xl font-black text-slate-900 mb-4">Sponsored by</h2>
      <div className="space-y-6">
        {tiers.map((t, i) => (
          <div key={t.name}>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{t.name}</p>
            <div className="flex flex-wrap items-center gap-3">
              {t.list.map((s) => {
                const body = s.logo_url ? (
                  <img
                    src={imageSrc(s.logo_url)}
                    alt={s.name}
                    title={s.name}
                    loading="lazy"
                    className={`${SIZES[Math.min(i, SIZES.length - 1)]} max-w-[10rem] object-contain`}
                  />
                ) : (
                  <span className="font-bold text-slate-800">{s.name}</span>
                );
                const cls = 'bg-white border-2 border-slate-200 rounded-xl px-4 py-3 flex items-center justify-center';
                return s.website_url ? (
                  <a key={s._id} href={s.website_url} target="_blank" rel="noopener noreferrer" className={`${cls} hover:border-orange-400 transition`}>
                    {body}
                  </a>
                ) : (
                  <div key={s._id} className={cls}>
                    {body}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
