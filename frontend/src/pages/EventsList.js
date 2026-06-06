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

  const runImages = [
    require('../assets/run1.jpg'),
    require('../assets/run2.jpg'),
    require('../assets/run3.jpg'),
    require('../assets/run4.jpg'),
  ];

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

  const getLowestPrice = (categories) => {
    if (!categories || categories.length === 0) return 0;
    return Math.min(...categories.map((cat) => cat.price));
  };

  const getCategoryNames = (categories) => {
    if (!categories || categories.length === 0) return 'Various';
    return categories.map((cat) => cat.name).join(', ');
  };

  const getRandomImage = (index) => {
    return runImages[index % runImages.length];
  };

  return (
    <div className="bg-gradient-to-b from-slate-50 via-white to-orange-50 min-h-screen">
      {/* Hero Banner */}
      <div className="relative h-96 bg-gradient-to-r from-slate-900 via-red-700 to-orange-600 overflow-hidden mb-12">
        <div className="absolute inset-0 opacity-20">
          <svg className="w-full h-full" viewBox="0 0 1000 400" preserveAspectRatio="none">
            <path d="M0,200 Q250,100 500,200 T1000,200 L1000,400 L0,400 Z" fill="rgba(255,255,255,0.1)" />
          </svg>
        </div>
        <div className="relative h-full flex flex-col justify-center items-center text-white text-center px-4">
          <h1 className="text-6xl font-black mb-4 tracking-tight">RUN4FUN</h1>
          <p className="text-2xl font-light tracking-wide">Join amazing running events near you</p>
          <p className="text-orange-200 mt-4 text-lg">Be part of the running revolution</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-16">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h2 className="text-4xl font-black text-slate-900 mb-2">Upcoming Events</h2>
            <p className="text-lg text-slate-600">Discover and register for the best running events</p>
          </div>
          {user && user.role === 'organizer' && (
            <Link
              to="/manage-events"
              className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-3 px-8 rounded-full shadow-lg hover:shadow-xl transition duration-300 transform hover:scale-105"
            >
              My Events
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-12 border-t-4 border-gradient-to-r from-orange-500 to-red-600">
          <h3 className="text-xl font-bold mb-6 text-slate-900">Search & Filter</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Search Events</label>
              <input
                type="text"
                name="search"
                placeholder="Event name..."
                value={filters.search}
                onChange={handleFilterChange}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Location</label>
              <input
                type="text"
                name="location"
                placeholder="City or country..."
                value={filters.location}
                onChange={handleFilterChange}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Category</label>
              <select
                name="category"
                value={filters.category}
                onChange={handleFilterChange}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 transition"
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
        </div>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-6 rounded-lg mb-8 font-semibold">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block">
              <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600 font-semibold">Finding amazing runs for you...</p>
            </div>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-lg">
            <p className="text-2xl text-gray-600 font-semibold mb-2">No events found</p>
            <p className="text-gray-500">Try adjusting your filters or check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {events.map((event, idx) => (
              <Link
                key={event._id}
                to={`/event/${event._id}`}
                className="group h-full"
              >
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden h-full hover:shadow-2xl transition duration-300 transform hover:scale-105">
                  {/* Image */}
                  <div className="relative h-56 overflow-hidden bg-gradient-to-br from-orange-400 to-red-600">
                    <img
                      src={getRandomImage(idx)}
                      alt={event.event_name}
                      className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                    <div className="absolute top-4 right-4 bg-gradient-to-r from-orange-500 to-red-600 text-white px-4 py-2 rounded-full text-sm font-bold">
                      {event.categories?.length || 0} categories
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <h3 className="text-xl font-black text-slate-900 mb-3 group-hover:text-orange-600 transition">
                      {event.event_name}
                    </h3>
                    <p className="text-sm text-slate-600 mb-4 line-clamp-2">{event.description}</p>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-2 text-slate-700">
                        <span className="text-lg">📍</span>
                        <span className="font-semibold">{event.location}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <span className="text-lg">📅</span>
                        <span className="font-semibold">{new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <span className="text-lg">🏃</span>
                        <span className="font-semibold text-sm">{getCategoryNames(event.categories)}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t-2 border-slate-100">
                      <div>
                        <p className="text-xs text-slate-500 font-semibold">From</p>
                        <p className="text-2xl font-black bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                          RM {getLowestPrice(event.categories).toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 font-semibold">Available</p>
                        <p className="text-lg font-black text-slate-900">{event.capacity} slots</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
