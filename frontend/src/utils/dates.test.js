import { toLocalInputValue, fromLocalInputValue } from './dates';

test('a date survives load → save unchanged (no timezone drift)', () => {
  const iso = '2027-02-13T23:00:00.000Z'; // 7:00 am on 14 Feb in Malaysia
  expect(fromLocalInputValue(toLocalInputValue(iso))).toBe(iso);
});

test('empty values', () => {
  expect(toLocalInputValue(null)).toBe('');
  expect(fromLocalInputValue('')).toBeNull();
});
