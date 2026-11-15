import apiClient from './apiClient';

// Downloads a file from the API (with the login token) and saves it, or opens it in a new tab.
export async function fetchBlob(path) {
  const res = await apiClient.get(path, { responseType: 'blob' });
  return res.data;
}

export async function downloadFile(path, filename) {
  const blob = await fetchBlob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function openFile(path) {
  // Open the tab first (synchronously) so pop-up blockers allow it, then point it at the file.
  const tab = window.open('', '_blank');
  const blob = await fetchBlob(path);
  const url = URL.createObjectURL(blob);
  if (tab) tab.location.href = url;
  else window.location.href = url;
}

// Error message from a failed blob request (the JSON error body arrives as a Blob).
export async function blobErrorMessage(err, fallback = 'Download failed') {
  try {
    const text = await err.response?.data?.text?.();
    return JSON.parse(text).message || fallback;
  } catch {
    return fallback;
  }
}
