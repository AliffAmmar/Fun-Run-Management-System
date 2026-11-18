import React, { useEffect, useRef } from 'react';

// Create Event: choose a cover + info pictures BEFORE the event exists. Files stay in the browser
// (with previews) and CreateEvent uploads them right after the event is created.
// value: { cover: { file, preview } | null, info: [{ key, file, preview, caption }] }
const btn = 'font-bold py-2 px-4 rounded-lg transition disabled:opacity-50';
const SUGGESTIONS = ['Race kit', 'Shirt size chart', 'Event poster', 'Route map', 'Medal'];
export const MAX_INFO_PICTURES = 12;

const withPreview = (file) => ({ file, preview: URL.createObjectURL(file) });

export default function PendingPicturesPicker({ value, onChange, disabled }) {
  const coverInput = useRef(null);
  const infoInput = useRef(null);
  const latest = useRef(value);
  latest.current = value;

  // Free the preview URLs when leaving the page.
  useEffect(
    () => () => {
      const v = latest.current;
      if (v.cover) URL.revokeObjectURL(v.cover.preview);
      v.info.forEach((i) => URL.revokeObjectURL(i.preview));
    },
    []
  );

  const setCover = (file) => {
    if (value.cover) URL.revokeObjectURL(value.cover.preview);
    onChange({ ...value, cover: file ? withPreview(file) : null });
  };
  const addInfo = (files) => {
    const room = MAX_INFO_PICTURES - value.info.length;
    const added = [...files].slice(0, room).map((file) => ({
      key: `${Date.now()}-${Math.random()}`,
      caption: '',
      ...withPreview(file),
    }));
    onChange({ ...value, info: [...value.info, ...added] });
  };
  const updateCaption = (key, caption) =>
    onChange({ ...value, info: value.info.map((i) => (i.key === key ? { ...i, caption } : i)) });
  const removeInfo = (key) => {
    const item = value.info.find((i) => i.key === key);
    if (item) URL.revokeObjectURL(item.preview);
    onChange({ ...value, info: value.info.filter((i) => i.key !== key) });
  };

  return (
    <div className="space-y-6">
      <p className="text-slate-600">Optional. Uploaded when you create the event; you can change them later in Edit Event.</p>

      {/* Cover */}
      <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 space-y-3">
        <p className="font-bold text-slate-900">Cover picture</p>
        <p className="text-sm text-slate-600">Shown on the event list and at the top of the event page. Landscape works best.</p>
        {value.cover ? (
          <img src={value.cover.preview} alt="Cover preview" className="w-full max-h-64 object-cover rounded-lg border border-slate-200" />
        ) : (
          <div className="w-full h-32 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-500 text-sm">
            No cover: a stock running photo will be shown
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={disabled} onClick={() => coverInput.current?.click()} className={`${btn} bg-gradient-to-r from-orange-500 to-red-600 text-white`}>
            {value.cover ? 'Choose another' : 'Choose cover'}
          </button>
          {value.cover && (
            <button type="button" disabled={disabled} onClick={() => setCover(null)} className={`${btn} bg-white border-2 border-slate-200 text-slate-800`}>
              Remove
            </button>
          )}
        </div>
        <input
          ref={coverInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) setCover(f);
          }}
        />
      </div>

      {/* Info pictures */}
      <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 space-y-4">
        <div>
          <p className="font-bold text-slate-900">Info pictures</p>
          <p className="text-sm text-slate-600">
            Kit photo, shirt size chart, poster, route map… Shown on the event page; the size chart also helps runners pick a
            shirt when registering.
          </p>
        </div>
        {value.info.length > 0 && (
          <ul className="grid sm:grid-cols-2 gap-3">
            {value.info.map((img) => (
              <li key={img.key} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <img src={img.preview} alt={img.caption || 'Info picture'} className="w-full aspect-[4/3] object-contain bg-white" />
                <div className="p-2 space-y-2">
                  <input
                    aria-label="Caption"
                    list="pending-caption-suggestions"
                    maxLength={120}
                    value={img.caption}
                    onChange={(e) => updateCaption(img.key, e.target.value)}
                    placeholder="Caption, e.g. Shirt size chart"
                    className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500"
                  />
                  <button type="button" disabled={disabled} onClick={() => removeInfo(img.key)} className={`${btn} w-full bg-white border-2 border-slate-200 text-red-600 text-sm`}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <datalist id="pending-caption-suggestions">
          {SUGGESTIONS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <button
          type="button"
          disabled={disabled || value.info.length >= MAX_INFO_PICTURES}
          onClick={() => infoInput.current?.click()}
          className={`${btn} bg-green-600 hover:bg-green-700 text-white`}
        >
          + Add pictures
        </button>
        <input
          ref={infoInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = e.target.files;
            if (files?.length) addInfo(files);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
