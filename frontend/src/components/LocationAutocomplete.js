import React, { useState, useEffect, useRef } from 'react';

export default function LocationAutocomplete({ value, onChange }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const suggestionsRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    // Close suggestions when clicking outside
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

      // Format the results to be more readable
      const formattedSuggestions = data.map((item) => ({
        id: item.place_id,
        display_name: item.display_name,
        // Extract the city/town name from the full address
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

    // Debounce the API call
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      fetchSuggestions(searchTerm);
    }, 300);
  };

  const handleSelectSuggestion = (suggestion) => {
    // Extract city/area name from the display_name
    const parts = suggestion.display_name.split(',');
    const location = parts.slice(0, 2).join(',').trim(); // Get city and state/country
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
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
      />

      {loading && (
        <div className="absolute right-3 top-2.5">
          <div className="animate-spin">
            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              onClick={() => handleSelectSuggestion(suggestion)}
              className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-200 last:border-b-0 transition"
            >
              <p className="font-medium text-gray-900">{suggestion.short_name}</p>
              <p className="text-sm text-gray-500">{suggestion.display_name.split(',').slice(-2).join(',')}</p>
            </button>
          ))}
        </div>
      )}

      {showSuggestions && value.length > 0 && suggestions.length === 0 && !loading && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3">
          <p className="text-sm text-gray-500">No locations found</p>
        </div>
      )}
    </div>
  );
}
