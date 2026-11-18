// Participant rows for registration: validation + CSV handling.
// Mirrors backend/utils/orderValidation.js so the user sees errors instantly. The server checks
// everything again, so keep the two in sync when rules change.
import Papa from 'papaparse';

export const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
// Shirt TYPE = the cut of the shirt, chosen freely (not the runner's gender).
export const SHIRT_TYPES = ['male', 'female'];
export const SHIRT_TYPE_LABEL = { male: 'Male', female: 'Female' };

// Same aliases as backend/utils/shirts.js (no single-letter L/P: "L" is also a size).
const TYPE_ALIASES = {
  male: 'male', m: 'male', men: 'male', man: 'male', mens: 'male', "men's": 'male', lelaki: 'male',
  female: 'female', f: 'female', women: 'female', woman: 'female', womens: 'female', "women's": 'female',
  ladies: 'female', lady: 'female', perempuan: 'female', wanita: 'female',
};
export const normalizeShirtType = (v) => TYPE_ALIASES[String(v || '').trim().toLowerCase()] || null;
export const shirtLabel = (p) => [SHIRT_TYPE_LABEL[p.shirt_type], p.shirt_size].filter(Boolean).join(' ');
export const MIN_GROUP_SIZE = 2;
export const MAX_GROUP_SIZE = 200;
export const MAX_NAME_LENGTH = 100;
export const CSV_COLUMNS = ['name', 'email', 'shirt_type', 'shirt_size'];

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export const emptyRow = () => ({ name: '', email: '', shirt_type: '', shirt_size: '' });

export const isBlankRow = (r) =>
  !r.name?.trim() && !r.email?.trim() && !r.shirt_size?.trim() && !String(r.shirt_type || '').trim();

// Normalised copy of a row, as it will be sent to the server.
export function cleanRow(r) {
  return {
    name: (r.name || '').trim().replace(/\s+/g, ' '),
    email: (r.email || '').trim().toLowerCase(),
    shirt_size: (r.shirt_size || '').trim().toUpperCase(),
    // 'male' / 'female' when recognised (M, Women, Perempuan…); otherwise the raw text, so it's flagged.
    shirt_type: normalizeShirtType(r.shirt_type) || String(r.shirt_type || '').trim(),
  };
}

// Returns { [rowIndex]: { name?, email?, shirt_type?, shirt_size? } } with a message per bad field.
// rowIndex is 0-based (table index); messages use 1-based "Row N" like the server.
export function validateRows(rows) {
  const errors = {};
  const firstRowForEmail = new Map();
  const add = (i, field, message) => {
    errors[i] = { ...errors[i], [field]: message };
  };

  rows.forEach((raw, i) => {
    const r = cleanRow(raw);
    const row = i + 1;

    if (!r.name) add(i, 'name', `Row ${row}: name is required`);
    else if (r.name.length > MAX_NAME_LENGTH) add(i, 'name', `Row ${row}: name is too long`);

    if (!r.shirt_type) add(i, 'shirt_type', `Row ${row}: shirt type (male or female) is required`);
    else if (!SHIRT_TYPES.includes(r.shirt_type)) {
      add(i, 'shirt_type', `Row ${row}: shirt type "${raw.shirt_type}" must be male or female`);
    }

    if (!r.shirt_size) add(i, 'shirt_size', `Row ${row}: shirt size is required`);
    else if (!SHIRT_SIZES.includes(r.shirt_size)) {
      add(i, 'shirt_size', `Row ${row}: "${raw.shirt_size}" is not one of ${SHIRT_SIZES.join(', ')}`);
    }

    if (r.email) {
      if (!EMAIL_RE.test(r.email)) add(i, 'email', `Row ${row}: "${raw.email}" is not a valid email`);
      else if (firstRowForEmail.has(r.email)) {
        add(i, 'email', `Row ${row}: same email as row ${firstRowForEmail.get(r.email)}`);
      } else firstRowForEmail.set(r.email, row);
    }
  });
  return errors;
}

// Server errors [{ row, field, message }] (1-based rows) → same shape as validateRows.
export function serverErrorsByRow(list = []) {
  const errors = {};
  list.forEach(({ row, field, message }) => {
    errors[row - 1] = { ...errors[row - 1], [field]: message };
  });
  return errors;
}

const zeroSizes = () => Object.fromEntries(SHIRT_SIZES.map((s) => [s, 0]));

// Same shape as the API: { shirt_sizes: totals per size, shirt_breakdown: { male: {...}, female: {...} } }.
export function shirtCounts(rows) {
  const shirt_sizes = zeroSizes();
  const shirt_breakdown = { male: zeroSizes(), female: zeroSizes() };
  rows.forEach((raw) => {
    const r = cleanRow(raw);
    if (shirt_sizes[r.shirt_size] === undefined) return;
    shirt_sizes[r.shirt_size] += 1;
    if (shirt_breakdown[r.shirt_type]) shirt_breakdown[r.shirt_type][r.shirt_size] += 1;
  });
  return { shirt_sizes, shirt_breakdown };
}

// Friendlier column names people might use in a spreadsheet.
const HEADER_ALIASES = { type: 'shirt_type', shirt_cut: 'shirt_type', cut: 'shirt_type', size: 'shirt_size', full_name: 'name' };

const parseWith = (input, encoding) =>
  new Promise((resolve) => {
    Papa.parse(input, {
      header: true,
      skipEmptyLines: 'greedy',
      encoding, // only used for File/Blob input
      transformHeader: (h) => {
        const key = h.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s-]+/g, '_');
        return HEADER_ALIASES[key] || key;
      },
      complete: (result) => resolve(result),
      error: (err) => resolve({ error: err }),
    });
  });

// Parses a CSV File with columns name,email,shirt_type,shirt_size (header required, any order, any case).
// Resolves { rows, problems } where problems are file-level issues (missing columns, etc.).
//
// Excel's plain "CSV (Comma delimited)" saves in Windows-1252, not UTF-8: names with é or curly
// apostrophes (’) would come out as "�". If that happens, the file is read again as Windows-1252.
export async function parseParticipantCsv(file) {
  let result = await parseWith(file, 'UTF-8');
  const isFile = typeof Blob !== 'undefined' && file instanceof Blob;
  if (isFile && !result.error && JSON.stringify(result.data).includes('\uFFFD')) {
    result = await parseWith(file, 'windows-1252');
  }
  if (result.error) return { rows: [], problems: [`Could not read the file: ${result.error.message}`] };

  const { data, meta } = result;
  const missing = ['name', 'shirt_type', 'shirt_size'].filter((c) => !meta.fields?.includes(c));
  if (missing.length > 0) {
    return {
      rows: [],
      problems: [
        `The file is missing the column(s): ${missing.join(', ')}. The first line must be: ${CSV_COLUMNS.join(',')}`,
      ],
    };
  }
  const rows = data
    .map((d) => ({ name: d.name || '', email: d.email || '', shirt_type: d.shirt_type || '', shirt_size: d.shirt_size || '' }))
    .filter((r) => !isBlankRow(r));
  return { rows, problems: [] };
}

export function downloadCsvTemplate() {
  // shirt_type is the shirt's cut (male or female), not the runner's gender.
  const csv =
    `${CSV_COLUMNS.join(',')}\n` +
    'Ahmad bin Ali,ahmad@example.com,male,M\n' +
    'Siti Aminah binti Hassan,,female,S\n' +
    'Nur Iman binti Yusof,iman@example.com,male,L\n';
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'run4fun-members-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}
