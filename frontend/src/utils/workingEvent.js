// The event staff are currently working (chosen on the Event Day page). Stored on this device so
// a scanned QR can warn when it belongs to a different event.
const KEY = 'run4fun.workingEventId';

export function getWorkingEventId() {
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

export function setWorkingEventId(id) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    // storage blocked (private mode): the warning just won't show
  }
}
