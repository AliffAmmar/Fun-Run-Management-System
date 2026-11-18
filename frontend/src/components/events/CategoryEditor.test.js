import { categoriesError, totalCapacity, toApiCategories } from './CategoryEditor';

test('total capacity is the sum of the categories (ignoring blanks)', () => {
  expect(totalCapacity([{ capacity: '120' }, { capacity: '80' }, { capacity: '' }])).toBe(200);
});

test('every category needs a price and a whole-number capacity', () => {
  expect(categoriesError([])).toMatch(/at least one category/);
  expect(categoriesError([{ name: '5km', price: '30', capacity: '' }])).toMatch(/capacity .* for 5km/);
  expect(categoriesError([{ name: '5km', price: '30', capacity: '2.5' }])).toMatch(/capacity/);
  expect(categoriesError([{ name: '5km', price: '', capacity: '10' }])).toMatch(/price for 5km/);
  expect(categoriesError([{ name: '5km', price: '0', capacity: '10' }])).toBe('');
});

test('sends numbers to the API', () => {
  expect(toApiCategories([{ name: '5km', price: '30.50', capacity: '120' }])).toEqual([{ name: '5km', price: 30.5, capacity: 120 }]);
});
