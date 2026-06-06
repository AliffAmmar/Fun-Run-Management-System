import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../utils/apiClient';
import { useAuth } from '../context/AuthContext';

export default function EventsList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    location: '',
    category: '',
    search: '',
  });
  const { user } = useAuth();

  useEffect(() => {
    fetchEvents();
  }, [filters]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.location) params.append('location', filters.location);
      if (filters.category) params.append('category', filters.category);
      if (filters.search) params.append('search', filters.search);

      const response = await apiClient.get(`/events?${params.toString()}`);
      setEvents(response.data.events);
      setError('');
    } catch (err) {
      setError('Failed to fetch events');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800">Browse Events</h1>
          {user && user.role === 'organizer' && (
            <Link
              to="/create-event"
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg"
            >
              Create Event
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-bold mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              name="search"
              placeholder="Search events..."
              value={filters.search}
              onChange={handleFilterChange}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              name="location"
              placeholder="Filter by location..."
              value={filters.location}
              onChange={handleFilterChange}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <select
              name="category"
              value={filters.category}
              onChange={handleFilterChange}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="">All Categories</option>
              <option value="5K">5K</option>
              <option value="10K">10K</option>
              <option value="Half Marathon">Half Marathon</option>
              <option value="Marathon">Marathon</option>
              <option value="Family Run">Family Run</option>
            </select>
          </div>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-600">Loading events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600">No events found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <Link
                key={event._id}
                to={`/event/${event._id}`}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden"
              >
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-40 flex items-center justify-center">
                  <h3 className="text-white text-xl font-bold text-center px-4">{event.event_name}</h3>
                </div>
                <div className="p-4">
                  <p className="text-sm text-gray-600 mb-2">📍 {event.location}</p>
                  <p className="text-sm text-gray-600 mb-2">📅 {new Date(event.date).toLocaleDateString()}</p>
                  <p className="text-sm text-gray-600 mb-2">🏃 {event.category}</p>
                  <p className="text-lg font-bold text-blue-600">RM {event.price}</p>
                  <p className="text-xs text-gray-500 mt-2">{event.capacity} slots available</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
