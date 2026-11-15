// <input type="datetime-local"> works in the browser's local time, without a timezone.
// Convert explicitly so dates don't shift by the timezone offset (8 h in Malaysia).

// Date (or ISO string from the API) → "YYYY-MM-DDTHH:mm" in local time, for the input's value.
export function toLocalInputValue(d) {
  if (!d) return '';
  const date = new Date(d);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// Input value (local time) → ISO string with timezone, for the API. Empty → null.
export function fromLocalInputValue(v) {
  return v ? new Date(v).toISOString() : null;
}
