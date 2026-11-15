import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import OrderCard from './OrderCard';

let container;
let root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const now = new Date('2027-01-01T10:00:00Z');
const base = {
  _id: 'o1',
  order_no: 'FR-1012',
  type: 'group',
  group_name: 'Kelab Larian Surau',
  race_category: '5km',
  participant_count: 2,
  total_amount: 70,
  shirt_sizes: { XS: 0, S: 1, M: 1, L: 0, XL: 0, XXL: 0 },
  event_id: { _id: 'e1', event_name: 'Charity Run', date: '2027-02-14T00:00:00Z', location: 'KL' },
  participants: [
    { _id: 'p1', name: 'Ahmad', shirt_size: 'M', bib_number: '0003' },
    { _id: 'p2', name: 'Siti', shirt_size: 'S', bib_number: '0004' },
  ],
};

function render(order, paymentMode = 'mock') {
  act(() => {
    root.render(
      <MemoryRouter>
        <OrderCard order={order} now={now} paymentMode={paymentMode} onShowQr={() => {}} onChanged={() => {}} />
      </MemoryRouter>
    );
  });
  return container.textContent;
}

test('paid order shows the QR, order number, bibs and kit status', () => {
  const text = render({ ...base, status: 'paid', kit_collected: false });
  expect(container.querySelector('svg')).not.toBeNull(); // QR code
  expect(text).toMatch('FR-1012');
  expect(text).toMatch('One QR for the whole group');
  expect(text).toMatch('0003');
  expect(text).toMatch('Kit not collected yet');
  expect(text).not.toMatch(/Pay RM/);
});

test('unpaid order shows Pay and Cancel, minutes left, and no QR', () => {
  const text = render({ ...base, status: 'pending', expires_at: '2027-01-01T10:12:00Z' });
  expect(container.querySelector('svg')).toBeNull();
  expect(text).toMatch('Awaiting payment');
  expect(text).toMatch('held for 12 more minutes');
  expect(text).toMatch('Pay RM 70.00 (demo)');
  expect(text).toMatch('Cancel registration');
});

test('a pending order past its hold time shows as expired with a re-register link', () => {
  const text = render({ ...base, status: 'pending', expires_at: '2027-01-01T09:00:00Z' });
  expect(text).toMatch('Expired');
  expect(text).toMatch('Register again');
  expect(text).not.toMatch(/Pay RM/);
});

test('after the event is completed, a group order offers each certificate and a ZIP', () => {
  const text = render({
    ...base,
    status: 'paid',
    participants: [
      { ...base.participants[0], email: 'a@x.com', certificate_no: 'FR-C-AAAA1111', certificate_status: 'sent' },
      { ...base.participants[1], certificate_no: 'FR-C-BBBB2222', certificate_status: 'skipped_no_email' },
    ],
  });
  expect(text).toMatch('Certificates are ready');
  expect(text).toMatch('Download all (2) as ZIP');
  expect(text).toMatch('Siti · no email');
});

test('no certificate section before the event is completed', () => {
  expect(render({ ...base, status: 'paid' })).not.toMatch('Certificates are ready');
});

test('shows "Fix a name or shirt size" only before the edit deadline', () => {
  expect(render({ ...base, status: 'paid', edit_until: '2027-01-05T00:00:00Z' })).toMatch('Fix a name or shirt size');
  expect(render({ ...base, status: 'paid', edit_until: '2026-12-31T00:00:00Z' })).not.toMatch('Fix a name or shirt size');
});
