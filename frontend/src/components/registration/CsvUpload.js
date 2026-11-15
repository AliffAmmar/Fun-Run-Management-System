import React, { useRef, useState } from 'react';
import { CSV_COLUMNS, parseParticipantCsv, downloadCsvTemplate } from '../../utils/participants';

// Upload a CSV of members (name,email,shirt_size). Rows go into the same editable table,
// where errors are shown per row, so nothing is hidden from the user.
export default function CsvUpload({ hasExistingRows, onLoaded }) {
  const inputRef = useRef(null);
  const [problems, setProblems] = useState([]);
  const [loadedMsg, setLoadedMsg] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-uploading the same file after fixing it
    if (!file) return;

    setProblems([]);
    setLoadedMsg('');
    const { rows, problems: fileProblems } = await parseParticipantCsv(file);
    if (fileProblems.length > 0) {
      setProblems(fileProblems);
      return;
    }
    if (rows.length === 0) {
      setProblems(['The file has no member rows.']);
      return;
    }
    if (
      hasExistingRows &&
      !window.confirm('Replace the members already in the table with the ones from this file?')
    ) {
      return;
    }
    onLoaded(rows);
    setLoadedMsg(`Loaded ${rows.length} member(s) from ${file.name}. Check the table below.`);
  };

  return (
    <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-5">
      <p className="font-bold text-slate-800 mb-1">Upload a CSV file</p>
      <p className="text-sm text-slate-600 mb-4">
        Columns: <code className="bg-white px-1 rounded">{CSV_COLUMNS.join(', ')}</code>. Email is optional. Sizes:
        XS, S, M, L, XL, XXL. You can export this from Excel or Google Sheets ("Save as CSV").
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-2 px-4 rounded-lg shadow transition"
        >
          Choose CSV file
        </button>
        <button
          type="button"
          onClick={downloadCsvTemplate}
          className="bg-white hover:bg-slate-100 border-2 border-slate-200 text-slate-800 font-bold py-2 px-4 rounded-lg transition"
        >
          Download template
        </button>
        <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
      </div>

      {loadedMsg && <p className="mt-3 text-sm font-semibold text-green-700">{loadedMsg}</p>}
      {problems.map((p) => (
        <p key={p} className="mt-3 text-sm font-semibold text-red-600">
          {p}
        </p>
      ))}
    </div>
  );
}
