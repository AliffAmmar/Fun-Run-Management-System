import {
  validateRows,
  parseParticipantCsv,
  shirtCounts,
  serverErrorsByRow,
  cleanRow,
  normalizeShirtType,
  shirtLabel,
  CSV_COLUMNS,
} from './participants';

test('validateRows flags each bad field with the 1-based row number', () => {
  const errors = validateRows([
    { name: 'Ok', email: 'a@x.com', shirt_type: 'male', shirt_size: 'm' },
    { name: '', email: '', shirt_type: 'female', shirt_size: 'M' },
    { name: 'Bad size', email: '', shirt_type: 'male', shirt_size: 'XXXL' },
    { name: 'Bad email', email: 'nope', shirt_type: 'male', shirt_size: 'S' },
    { name: 'Dup', email: 'A@X.com', shirt_type: 'male', shirt_size: 'S' },
    { name: 'No type', email: '', shirt_type: '', shirt_size: 'S' },
    { name: 'Bad type', email: '', shirt_type: 'unisex', shirt_size: 'S' },
  ]);
  expect(Object.keys(errors).map(Number)).toEqual([1, 2, 3, 4, 5, 6]);
  expect(errors[1].name).toMatch(/^Row 2: name is required/);
  expect(errors[2].shirt_size).toMatch(/XXXL/);
  expect(errors[3].email).toMatch(/not a valid email/);
  expect(errors[4].email).toMatch(/same email as row 1/);
  expect(errors[5].shirt_type).toMatch(/shirt type \(male or female\) is required/);
  expect(errors[6].shirt_type).toMatch(/"unisex" must be male or female/);
});

test('shirt type accepts common spellings (not single-letter L/P, which look like sizes)', () => {
  expect(['Male', 'M', 'men', 'lelaki'].map(normalizeShirtType)).toEqual(['male', 'male', 'male', 'male']);
  expect(['female', 'F', 'Women', 'perempuan'].map(normalizeShirtType)).toEqual(['female', 'female', 'female', 'female']);
  expect(['L', 'P', 'unisex', ''].map(normalizeShirtType)).toEqual([null, null, null, null]);
});

test('the CSV template columns include shirt_type', () => {
  expect(CSV_COLUMNS).toEqual(['name', 'email', 'shirt_type', 'shirt_size']);
});

test('parses a CSV with messy headers, BOM, blank lines, missing emails and M/F types', async () => {
  const csv = '﻿Name , Email,Shirt Type,Shirt Size\nAhmad bin Ali,ahmad@x.com,M,m\n\nSiti,,Female,S\n , , , \n';
  const { rows, problems } = await parseParticipantCsv(csv);
  expect(problems).toEqual([]);
  expect(rows).toEqual([
    { name: 'Ahmad bin Ali', email: 'ahmad@x.com', shirt_type: 'M', shirt_size: 'm' },
    { name: 'Siti', email: '', shirt_type: 'Female', shirt_size: 'S' },
  ]);
  expect(rows.map(cleanRow).map((r) => r.shirt_type)).toEqual(['male', 'female']);
});

test('accepts "type" / "size" as column names', async () => {
  const { rows, problems } = await parseParticipantCsv('name,type,size\nAisyah,female,S\n');
  expect(problems).toEqual([]);
  expect(cleanRow(rows[0])).toMatchObject({ shirt_type: 'female', shirt_size: 'S' });
});

test('an old file without the shirt_type column is rejected with a clear message', async () => {
  const { rows, problems } = await parseParticipantCsv('name,email,shirt_size\nA,,M\n');
  expect(rows).toEqual([]);
  expect(problems[0]).toMatch(/missing the column\(s\): shirt_type\. The first line must be: name,email,shirt_type,shirt_size/);
});

test('shirt counts: totals per size and split by type', () => {
  const { shirt_sizes, shirt_breakdown } = shirtCounts([
    { shirt_type: 'male', shirt_size: 'm' },
    { shirt_type: 'F', shirt_size: 'M' },
    { shirt_type: 'male', shirt_size: 'xl' },
  ]);
  expect(shirt_sizes).toEqual({ XS: 0, S: 0, M: 2, L: 0, XL: 1, XXL: 0 });
  expect(shirt_breakdown.male).toMatchObject({ M: 1, XL: 1 });
  expect(shirt_breakdown.female).toMatchObject({ M: 1 });
  expect(shirtLabel({ shirt_type: 'female', shirt_size: 'S' })).toBe('Female S');
});

test('server errors map back to table rows', () => {
  expect(serverErrorsByRow([{ row: 3, field: 'email', message: 'x' }])).toEqual({ 2: { email: 'x' } });
  expect(cleanRow({ name: '  Lim  Wei ', email: ' L@X.COM', shirt_type: 'Men', shirt_size: 'xs' })).toEqual({
    name: 'Lim Wei',
    email: 'l@x.com',
    shirt_size: 'XS',
    shirt_type: 'male',
  });
});

test('re-reads a file saved by Excel in Windows-1252 (é, curly apostrophe) instead of showing �', async () => {
  // "name,shirt_type,shirt_size\nJosé O’Neil,male,M\n" in Windows-1252: é = 0xE9, ’ = 0x92
  const bytes = [
    ...Buffer.from('name,shirt_type,shirt_size\nJos'), 0xe9, ...Buffer.from(' O'), 0x92, ...Buffer.from('Neil,male,M\n'),
  ];
  const file = new File([new Uint8Array(bytes)], 'excel.csv', { type: 'text/csv' });
  const { rows, problems } = await parseParticipantCsv(file);
  expect(problems).toEqual([]);
  expect(rows[0].name).toBe('José O’Neil');
});

test('a normal UTF-8 file with accents is read as-is', async () => {
  const file = new File(['name,shirt_type,shirt_size\nJosé O’Neil,female,M\n'], 'utf8.csv', { type: 'text/csv' });
  expect((await parseParticipantCsv(file)).rows[0].name).toBe('José O’Neil');
});
