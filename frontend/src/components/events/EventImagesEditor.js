import React, { useRef, useState } from 'react';
import apiClient from '../../utils/apiClient';
import { imageSrc, uploadEventImage } from '../../utils/eventImages';

// Organizer: cover picture + info pictures (kit, size chart, poster…) for an existing event.
// Changes save immediately (separate from the event form's Save button).
const btn = 'font-bold py-2 px-4 rounded-lg transition disabled:opacity-50';
const SUGGESTIONS = ['Race kit', 'Shirt size chart', 'Event poster', 'Route map', 'Medal'];

export default function EventImagesEditor({ eventId, coverImage, infoImages, onChange }) {
  const coverInput = useRef(null);
  const infoInput = useRef(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [newCaption, setNewCaption] = useState('');
  const [captions, setCaptions] = useState({}); // imageId → edited caption

  const run = async (label, fn) => {
    setBusy(label);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Something went wrong');
    } finally {
      setBusy('');
    }
  };

  const uploadCover = (file) =>
    run('cover', async () => {
      const image = await uploadEventImage(eventId, file, { kind: 'cover' });
      onChange({ cover_image: image.url, info_images: infoImages });
      setNotice('Cover picture saved');
    });

  const removeCover = () =>
    run('cover', async () => {
      const id = coverImage.split('/').pop();
      await apiClient.delete(`/events/${eventId}/images/${id}`);
      onChange({ cover_image: null, info_images: infoImages });
      setNotice('Cover picture removed');
    });

  const addInfo = (file) =>
    run('info', async () => {
      const image = await uploadEventImage(eventId, file, { kind: 'info', caption: newCaption.trim() });
      onChange({ cover_image: coverImage, info_images: [...infoImages, image] });
      setNewCaption('');
      setNotice('Picture added');
    });

  const saveCaption = (img) =>
    run(img._id, async () => {
      const res = await apiClient.patch(`/events/${eventId}/images/${img._id}`, { caption: captions[img._id] ?? img.caption });
      onChange({
        cover_image: coverImage,
        info_images: infoImages.map((x) => (x._id === img._id ? { ...x, caption: res.data.caption } : x)),
      });
      setNotice('Caption saved');
    });

  const removeInfo = (img) => {
    if (!window.confirm('Remove this picture?')) return;
    run(img._id, async () => {
      await apiClient.delete(`/events/${eventId}/images/${img._id}`);
      onChange({ cover_image: coverImage, info_images: infoImages.filter((x) => x._id !== img._id) });
      setNotice('Picture removed');
    });
  };

  const pick = (ref, handler) => (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) handler(file);
  };

  return (
    <section id="pictures" className="space-y-6 scroll-mt-24">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Pictures</h2>
        <p className="text-slate-600">Saved as soon as you upload. JPEG, PNG or WebP; big phone photos are shrunk automatically.</p>
      </div>
      {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 rounded-lg font-semibold">{error}</div>}
      {notice && <div className="bg-green-100 border-l-4 border-green-500 text-green-800 p-3 rounded-lg font-semibold">{notice}</div>}

      {/* Cover */}
      <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 space-y-3">
        <p className="font-bold text-slate-900">Cover picture</p>
        <p className="text-sm text-slate-600">Shown on the event list and at the top of the event page. Landscape works best.</p>
        {coverImage ? (
          <img src={imageSrc(coverImage)} alt="Event cover" className="w-full max-h-64 object-cover rounded-lg border border-slate-200" />
        ) : (
          <div className="w-full h-32 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-500 text-sm">
            No cover yet: a stock running photo is shown
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!!busy} onClick={() => coverInput.current?.click()} className={`${btn} bg-gradient-to-r from-orange-500 to-red-600 text-white`}>
            {busy === 'cover' ? 'Uploading…' : coverImage ? 'Replace cover' : 'Upload cover'}
          </button>
          {coverImage && (
            <button type="button" disabled={!!busy} onClick={removeCover} className={`${btn} bg-white border-2 border-slate-200 text-slate-800`}>
              Remove
            </button>
          )}
        </div>
        <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={pick(coverInput, uploadCover)} />
      </div>

      {/* Info pictures */}
      <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 space-y-4">
        <div>
          <p className="font-bold text-slate-900">Info pictures</p>
          <p className="text-sm text-slate-600">
            Kit photo, shirt size chart, poster, route map… Shown on the event page, and the size chart helps runners choose a
            shirt when registering.
          </p>
        </div>

        {infoImages.length > 0 && (
          <ul className="grid sm:grid-cols-2 gap-3">
            {infoImages.map((img) => (
              <li key={img._id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <img src={imageSrc(img.url)} alt={img.caption || 'Info picture'} className="w-full aspect-[4/3] object-contain bg-white" />
                <div className="p-2 space-y-2">
                  <input
                    aria-label="Caption"
                    maxLength={120}
                    value={captions[img._id] ?? img.caption}
                    onChange={(e) => setCaptions({ ...captions, [img._id]: e.target.value })}
                    placeholder="Caption, e.g. Shirt size chart"
                    className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!!busy || (captions[img._id] ?? img.caption) === img.caption}
                      onClick={() => saveCaption(img)}
                      className={`${btn} flex-1 bg-slate-900 text-white text-sm`}
                    >
                      Save caption
                    </button>
                    <button type="button" disabled={!!busy} onClick={() => removeInfo(img)} className={`${btn} bg-white border-2 border-slate-200 text-red-600 text-sm`}>
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2">
          <label htmlFor="new-caption" className="block text-sm font-bold text-slate-700 uppercase tracking-wide">
            Caption for the next picture
          </label>
          <input
            id="new-caption"
            list="caption-suggestions"
            maxLength={120}
            value={newCaption}
            onChange={(e) => setNewCaption(e.target.value)}
            placeholder="e.g. Shirt size chart"
            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500"
          />
          <datalist id="caption-suggestions">
            {SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <button type="button" disabled={!!busy} onClick={() => infoInput.current?.click()} className={`${btn} bg-green-600 hover:bg-green-700 text-white`}>
            {busy === 'info' ? 'Uploading…' : '+ Add picture'}
          </button>
          <input ref={infoInput} type="file" accept="image/*" className="hidden" onChange={pick(infoInput, addInfo)} />
        </div>
      </div>
    </section>
  );
}
