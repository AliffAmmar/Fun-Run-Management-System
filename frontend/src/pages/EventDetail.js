import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../utils/apiClient';
import { useAuth } from '../context/AuthContext';

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const runImages = [
    require('../assets/run1.jpg'),
    require('../assets/run2.jpg'),
    require('../assets/run3.jpg'),
    require('../assets/run4.jpg'),
  ];

  useEffect(() => {
    fetchEvent();
  }, [id]);

  const fetchEvent = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/events/${id}`);
      setEvent(response.data.event);
    } catch (err) {
      setError('Failed to load event');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-semibold">Loading event details...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl text-slate-600 font-bold">Event not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-slate-50 via-white to-orange-50 min-h-screen pb-12">
      {/* Hero Image Section */}
      <div className="relative h-96 overflow-hidden bg-gradient-to-br from-slate-900 via-red-700 to-orange-600">
        <img
          src={runImages[Math.floor(Math.random() * runImages.length)]}
          alt={event.event_name}
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
        <button
          onClick={() => navigate(-1)}
          className="absolute top-6 left-6 bg-white/90 hover:bg-white text-slate-900 font-bold py-2 px-4 rounded-full shadow-lg transition"
        >
          ← Back
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-6 -mt-24 relative z-10">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-red-700 to-orange-600 p-8 text-white">
            <h1 className="text-4xl font-black mb-3">{event.event_name}</h1>
            <p className="text-orange-100 text-lg font-light">{event.description}</p>
          </div>

          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-6 m-6">
              {error}
            </div>
          )}

          <div className="p-8">
            {/* Event Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="text-4xl">📅</div>
                  <div>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Date & Time</p>
                    <p className="text-xl font-bold text-slate-900">{new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    <p className="text-lg text-orange-600 font-semibold">{new Date(event.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="text-4xl">📍</div>
                  <div>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Location</p>
                    <p className="text-xl font-bold text-slate-900">{event.location}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="text-4xl">👥</div>
                  <div>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Available Slots</p>
                    <p className="text-xl font-bold text-slate-900">{event.capacity} Participants</p>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="text-4xl">👨‍💼</div>
                <div>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Organized By</p>
                  <p className="text-xl font-bold text-slate-900">{event.organizer_id?.name}</p>
                  <p className="text-slate-600">{event.organizer_id?.email}</p>
                </div>
              </div>
            </div>

            {/* Categories and Pricing */}
            {event.categories && event.categories.length > 0 && (
              <div className="mb-8 border-t-2 border-b-2 border-slate-200 py-8">
                <h2 className="text-2xl font-black text-slate-900 mb-6">Race Categories & Pricing</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {event.categories.map((cat, idx) => (
                    <div
                      key={idx}
                      className="bg-gradient-to-br from-slate-50 to-orange-50 p-6 rounded-xl border-2 border-orange-200 hover:border-orange-500 hover:shadow-lg transition"
                    >
                      <p className="font-bold text-slate-900 text-lg mb-2">{cat.name}</p>
                      <p className="text-3xl font-black bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                        RM {cat.price.toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-600 mt-2 font-semibold">Per person</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Registration Button */}
            <div className="flex gap-4">
              {user && user.role !== 'organizer' && (
                <button
                  onClick={() => navigate(`/register/${id}`)}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition duration-300 transform hover:scale-105 text-lg uppercase tracking-wide"
                >
                  Register Now 🏃
                </button>
              )}

              {!user && (
                <button
                  onClick={() => navigate('/login')}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition duration-300 transform hover:scale-105 text-lg uppercase tracking-wide"
                >
                  Login to Register
                </button>
              )}

              <button
                onClick={() => navigate('/events')}
                className="bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold py-4 px-8 rounded-xl transition duration-300 text-lg uppercase tracking-wide"
              >
                View All Events
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
