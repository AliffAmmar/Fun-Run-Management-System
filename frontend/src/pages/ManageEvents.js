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
        return 'bg-yellow-100 text-yellow-800';
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center">
            <p className="text-gray-500">Loading your events...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Manage Events</h1>
          <button
            onClick={() => navigate('/create-event')}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition"
          >
            + Create New Event
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
            {successMessage}
          </div>
        )}

        {events.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">You haven't created any events yet.</p>
            <button
              onClick={() => navigate('/create-event')}
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition"
            >
              Create Your First Event
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            {events.map((event) => (
              <div key={event._id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900">{event.event_name}</h3>
                    <p className="text-gray-600 text-sm mt-1">{event.description}</p>
                  </div>
                  <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusBadgeColor(event.status)}`}>
                    {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                  <div>
                    <p className="text-gray-500">Date</p>
                    <p className="font-semibold text-gray-900">{formatDate(event.date)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Location</p>
                    <p className="font-semibold text-gray-900">{event.location}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Capacity</p>
                    <p className="font-semibold text-gray-900">{event.capacity}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Categories</p>
                    <p className="font-semibold text-gray-900">{event.categories?.length || 0}</p>
                  </div>
                </div>

                {event.categories && event.categories.length > 0 && (
                  <div className="mb-4 bg-gray-50 p-3 rounded">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Categories & Pricing:</p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      {event.categories.map((cat, idx) => (
                        <div key={idx} className="bg-white p-2 rounded text-xs">
                          <p className="font-semibold">{cat.name}</p>
                          <p className="text-green-600">RM {cat.price.toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => navigate(`/edit-event/${event._id}`)}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded transition"
                  >
                    Edit
                  </button>
                  {event.status === 'draft' && (
                    <button
                      onClick={() => handlePublishEvent(event._id)}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded transition"
                    >
                      Publish
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteEvent(event._id)}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
