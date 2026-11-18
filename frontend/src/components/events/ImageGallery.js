import React, { useCallback, useEffect, useState } from 'react';
import { imageSrc } from '../../utils/eventImages';

// Full-screen viewer for event pictures (kit photo, size chart, poster…). Swipe-free: arrows + keys.
export function ImageViewer({ images, startIndex = 0, onClose }) {
  const [i, setI] = useState(startIndex);
  const prev = useCallback(() => setI((x) => (x - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setI((x) => (x + 1) % images.length), [images.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, prev, next]);

  const img = images[i];
  if (!img) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={img.caption || 'Event picture'} className="fixed inset-0 z-[60] bg-black/90 flex flex-col">
      <div className="flex justify-between items-center p-3 text-white">
        <span className="text-sm font-semibold">
          {i + 1} / {images.length}
        </span>
        <button onClick={onClose} aria-label="Close" className="text-3xl leading-none px-3">
          ×
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center px-2 min-h-0">
        <img src={imageSrc(img.url)} alt={img.caption || 'Event picture'} className="max-w-full max-h-full object-contain" />
      </div>
      {img.caption && <p className="text-white text-center font-semibold px-4 py-2">{img.caption}</p>}
      {images.length > 1 && (
        <div className="flex justify-center gap-6 pb-6 pt-2">
          <button onClick={prev} className="bg-white/15 text-white font-bold rounded-full px-6 py-3">
            ← Prev
          </button>
          <button onClick={next} className="bg-white/15 text-white font-bold rounded-full px-6 py-3">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// Thumbnail grid with captions; tapping opens the viewer.
export default function ImageGallery({ images }) {
  const [open, setOpen] = useState(null);
  if (!images?.length) return null;
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {images.map((img, idx) => (
          <button
            key={img._id}
            type="button"
            onClick={() => setOpen(idx)}
            className="text-left bg-white rounded-xl border-2 border-slate-200 hover:border-orange-400 overflow-hidden transition"
          >
            <img src={imageSrc(img.url)} alt={img.caption || 'Event picture'} loading="lazy" className="w-full aspect-[4/3] object-contain bg-white" />
            {img.caption && <p className="px-3 py-2 text-sm font-semibold text-slate-800">{img.caption}</p>}
          </button>
        ))}
      </div>
      {open !== null && <ImageViewer images={images} startIndex={open} onClose={() => setOpen(null)} />}
    </>
  );
}
