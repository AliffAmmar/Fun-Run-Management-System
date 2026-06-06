import React, { useState, useEffect, useRef } from 'react';

export default function LocationAutocomplete({ value, onChange }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const suggestionsRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = async (searchTerm) => {
    if (searchTerm.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchTerm)}&limit=8&countrycodes=MY`
      );
      const data = await response.json();

      const formattedSuggestions = data.map((item) => ({
        id: item.place_id,
        display_name: item.display_name,
        short_name: item.address?.city || item.address?.town || item.name,
      }));

      setSuggestions(formattedSuggestions);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error fetching location suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const searchTerm = e.target.value;
    onChange(searchTerm);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      fetchSuggestions(searchTerm);
    }, 300);
  };

  const handleSelectSuggestion = (suggestion) => {
    const parts = suggestion.display_name.split(',');
    const location = parts.slice(0, 2).join(',').trim();
    onChange(location);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  return (
    <div className="relative" ref={suggestionsRef}>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={() => value.length > 0 && suggestions.length > 0 && setShowSuggestions(true)}
        placeholder="City, Country"
        className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 transition text-lg"
      />

      {loading && (
        <div className="absolute right-4 top-3.5">
          <div className="animate-spin">
            <svg className="h-5 w-5 text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white border-2 border-orange-200 rounded-xl shadow-2xl max-h-80 overflow-y-auto">
          {suggestions.map((suggestion, idx) => (
            <button
              key={suggestion.id}
              onClick={() => handleSelectSuggestion(suggestion)}
              className={`w-full text-left px-4 py-4 hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 transition border-b border-slate-100 last:border-b-0 ${
                idx === 0 ? 'rounded-t-xl' : ''
              } ${idx === suggestions.length - 1 ? 'rounded-b-xl' : ''}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">📍</span>
                <div>
                  <p className="font-bold text-slate-900">{suggestion.short_name}</p>
                  <p className="text-sm text-slate-600">{suggestion.display_name.split(',').slice(-2).join(',')}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showSuggestions && value.length > 0 && suggestions.length === 0 && !loading && (
        <div className="absolute z-50 w-full mt-2 bg-white border-2 border-slate-200 rounded-xl shadow-lg p-4">
          <p className="text-sm text-slate-600 text-center font-semibold">No locations found in Malaysia</p>
        </div>
      )}
    </div>
  );
}
