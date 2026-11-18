import apiClient from './apiClient';

// Full address of an event picture. The API returns paths like "/events/<id>/images/<imageId>"
// relative to the API base ("/api" in development).
export const imageSrc = (path) => (path ? `${(apiClient.defaults.baseURL || '').replace(/\/+$/, '')}${path}` : null);

const KEEP_AS_IS = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SIDE = 2000;

// Phone photos are often 5–12 MB (or HEIC). Small PNG/JPEG/WebP files are uploaded as they are (keeps
// a crisp size chart sharp); anything else is redrawn as a JPEG at most 2000 px on its longest side.
export async function prepareImage(file) {
  if (KEEP_AS_IS.includes(file.type) && file.size <= 2 * 1024 * 1024) return { blob: file, type: file.type };

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("This picture can't be read. Please use a JPEG or PNG."));
      el.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) throw new Error('Could not prepare the picture');
    return { blob, type: 'image/jpeg' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Uploads a picture for an event. kind: 'cover' | 'info'.
export async function uploadEventImage(eventId, file, { kind, caption = '' }) {
  const { blob, type } = await prepareImage(file);
  const params = new URLSearchParams({ kind });
  if (caption) params.set('caption', caption);
  const res = await apiClient.post(`/events/${eventId}/images?${params}`, blob, { headers: { 'Content-Type': type } });
  return res.data.image;
}
