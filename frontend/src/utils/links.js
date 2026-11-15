// Public base URL for links that leave this browser (QR codes, emails).
// Set REACT_APP_PUBLIC_URL when phones must reach the site (LAN IP, tunnel or deployed URL,
// see CLAUDE.md §9). Otherwise the current site address is used.
export const publicBaseUrl = () =>
  (process.env.REACT_APP_PUBLIC_URL || window.location.origin).replace(/\/+$/, '');

// What the order's QR code contains: a link only, no personal data.
export const checkinUrl = (orderNo) => `${publicBaseUrl()}/checkin/${encodeURIComponent(orderNo)}`;
