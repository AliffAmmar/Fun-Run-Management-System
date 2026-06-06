import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../utils/apiClient';

export default function ManageEvents() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchOrganizerEvents();
  }, []);

  const fetchOrganizerEvents = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/events/organizer/my-events');
      setEvents(response.data.events || []);
      setError('');
    } catch (err) {
      setError('Failed to fetch events');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) {
      return;
    }

    try {
      await apiClient.delete(`/events/${eventId}`);
      setSuccessMessage('Event deleted successfully');
      fetchOrganizerEvents();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete event');
    }
  };

  const handlePublishEvent = async (eventId) => {
    try {
      await apiClient.post(`/events/${eventId}/publish`);
      setSuccessMessage('Event published successfully');
      fetchOrganizerEvents();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to publish event');
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'draft':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'published':
        return 'bg-green-100 border-green-300 text-green-800';
      case 'closed':
        return 'bg-red-100 border-red-300 text-red-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-block">
            <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-600 font-semibold">Loading your events...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-slate-50 via-white to-orange-50 min-h-screen py-12 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-black text-slate-900 mb-2">My Events</h1>
            <p className="text-lg text-slate-600">Create, manage and track your running events</p>
          </div>
          <button
            onClick={() => navigate('/create-event')}
            className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-3 px-8 rounded-full shadow-lg hover:shadow-xl transition duration-300 transform hover:scale-105 text-lg uppercase tracking-wide"
          >
            + Create Event
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 px-6 py-4 rounded-lg mb-8 font-semibold">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 px-6 py-4 rounded-lg mb-8 font-semibold">
            ✓ {successMessage}
          </div>
        )}

        {events.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center border-t-4 border-orange-500">
            <div className="text-6xl mb-4">🏃</div>
            <p className="text-2xl text-slate-900 font-bold mb-2">No events created yet</p>
            <p className="text-slate-600 mb-8">Start creating amazing running events and build your community</p>
            <button
              onClick={() => navigate('/create-event')}
              className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-3 px-8 rounded-full shadow-lg hover:shadow-xl transition duration-300 transform hover:scale-105"
            >
              Create Your First Event
            </button>
          </div>
        ) : (
          <div className="grid gap-8">
            {events.map((event) => (
              <div
                key={event._id}
                className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition duration-300 overflow-hidden border-l-4 border-orange-500"
              >
                <div className="flex flex-col md:flex-row">
                  {/* Left Info Section */}
                  <div className="flex-1 p-8">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-2xl font-black text-slate-900 mb-2">{event.event_name}</h3>
                        <p className="text-slate-600 line-clamp-2">{event.description}</p>
                      </div>
                      <span
                        className={`px-6 py-2 rounded-full text-sm font-bold border-2 whitespace-nowrap ml-4 ${getStatusBadgeColor(event.status)}`}
                      >
                        {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                      </span>
                    </div>

                    {/* Event Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6 text-sm">
                      <div>
                        <p className="text-slate-500 font-bold uppercase text-xs mb-1">Date & Time</p>
                        <p className="font-bold text-slate-900">{formatDate(event.date)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-bold uppercase text-xs mb-1">Location</p>
                        <p className="font-bold text-slate-900">{event.location}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-bold uppercase text-xs mb-1">Capacity</p>
                        <p className="font-bold text-slate-900">{event.capacity} slots</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-bold uppercase text-xs mb-1">Categories</p>
                        <p className="font-bold text-slate-900">{event.categories?.length || 0}</p>
                      </div>
                    </div>

                    {/* Categories */}
                    {event.categories && event.categories.length > 0 && (
                      <div className="bg-gradient-to-r from-slate-50 to-orange-50 p-4 rounded-lg mb-6">
                        <p className="text-xs font-bold text-slate-700 uppercase mb-3 tracking-wide">Categories & Pricing</p>
                        <div className="flex flex-wrap gap-2">
                          {event.categories.map((cat, idx) => (
                            <div key={idx} className="bg-white px-3 py-2 rounded-lg border-2 border-orange-200 text-xs font-bold">
                              <span className="text-slate-900">{cat.name}</span>
                              <span className="text-orange-600 ml-2">RM {cat.price.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-3 p-8 bg-gradient-to-br from-slate-50 to-orange-50 border-t-2 md:border-t-0 md:border-l-2 border-slate-200 justify-center">
                    <button
                      onClick={() => navigate(`/edit-event/${event._id}`)}
                      className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition duration-300 transform hover:scale-105 font-semibold uppercase tracking-wide"
                    >
                      ✏️ Edit
                    </button>
                    {event.status === 'draft' && (
                      <button
                        onClick={() => handlePublishEvent(event._id)}
                        className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition duration-300 transform hover:scale-105 font-semibold uppercase tracking-wide"
                      >
                        📤 Publish
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteEvent(event._id)}
                      className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-lg transition duration-300 transform hover:scale-105 font-semibold uppercase tracking-wide"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
