import { validateRows, parseParticipantCsv, shirtSizeCounts, serverErrorsByRow, cleanRow } from './participants';

test('validateRows flags each bad field with the 1-based row number', () => {
  const errors = validateRows([
    { name: 'Ok', email: 'a@x.com', shirt_size: 'm' },
    { name: '', email: '', shirt_size: 'M' },
    { name: 'Bad size', email: '', shirt_size: 'XXXL' },
    { name: 'Bad email', email: 'nope', shirt_size: 'S' },
    { name: 'Dup', email: 'A@X.com', shirt_size: 'S' },
  ]);
  expect(Object.keys(errors).map(Number)).toEqual([1, 2, 3, 4]);
  expect(errors[1].name).toMatch(/^Row 2: name is required/);
  expect(errors[2].shirt_size).toMatch(/XXXL/);
  expect(errors[3].email).toMatch(/not a valid email/);
  expect(errors[4].email).toMatch(/same email as row 1/);
});

test('parses a CSV with messy headers, BOM, blank lines and missing emails', async () => {
  const csv = '﻿Name , Email,Shirt Size\nAhmad bin Ali,ahmad@x.com,m\n\nSiti,,S\n , , \n';
  const { rows, problems } = await parseParticipantCsv(csv);
  expect(problems).toEqual([]);
  expect(rows).toEqual([
    { name: 'Ahmad bin Ali', email: 'ahmad@x.com', shirt_size: 'm' },
    { name: 'Siti', email: '', shirt_size: 'S' },
  ]);
});

test('reports missing required columns', async () => {
  const { rows, problems } = await parseParticipantCsv('full name,size\nA,M\n');
  expect(rows).toEqual([]);
  expect(problems[0]).toMatch(/missing the column\(s\): name, shirt_size/);
});

test('shirt size counts come from the rows', () => {
  expect(shirtSizeCounts([{ shirt_size: 'm' }, { shirt_size: 'M' }, { shirt_size: 'xl' }])).toEqual({
    XS: 0, S: 0, M: 2, L: 0, XL: 1, XXL: 0,
  });
});

test('server errors map back to table rows', () => {
  expect(serverErrorsByRow([{ row: 3, field: 'email', message: 'x' }])).toEqual({ 2: { email: 'x' } });
  expect(cleanRow({ name: '  Lim  Wei ', email: ' L@X.COM', shirt_size: 'xs' })).toEqual({
    name: 'Lim Wei', email: 'l@x.com', shirt_size: 'XS',
  });
});
