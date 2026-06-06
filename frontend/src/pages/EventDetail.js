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
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!event) {
    return <div className="min-h-screen flex items-center justify-center">Event not found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-8">
        <button
          onClick={() => navigate(-1)}
          className="text-blue-500 hover:underline mb-4"
        >
          ← Back
        </button>

        <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-40 rounded-lg flex items-center justify-center mb-6">
          <h1 className="text-white text-3xl font-bold text-center">{event.event_name}</h1>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-gray-600">Date</p>
            <p className="text-lg font-semibold">{new Date(event.date).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-gray-600">Time</p>
            <p className="text-lg font-semibold">{new Date(event.date).toLocaleTimeString()}</p>
          </div>
          <div>
            <p className="text-gray-600">Location</p>
            <p className="text-lg font-semibold">{event.location}</p>
          </div>
          <div>
            <p className="text-gray-600">Capacity</p>
            <p className="text-lg font-semibold">{event.capacity} slots</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-gray-600">Description</p>
          <p className="text-gray-700">{event.description || 'No description provided'}</p>
        </div>

        {/* Categories and Pricing */}
        {event.categories && event.categories.length > 0 && (
          <div className="mb-6 border border-gray-300 rounded-lg p-4 bg-gray-50">
            <p className="text-lg font-semibold mb-4 text-gray-900">Available Categories & Pricing:</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {event.categories.map((cat, idx) => (
                <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200">
                  <p className="font-semibold text-gray-900">{cat.name}</p>
                  <p className="text-lg font-bold text-blue-600">RM {cat.price.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-6">
          <p className="text-gray-600">Organized by</p>
          <p className="text-lg font-semibold">{event.organizer_id?.name}</p>
        </div>

        {user && (
          <button
            onClick={() => navigate(`/register/${id}`)}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg"
          >
            Register for This Event
          </button>
        )}

        {!user && (
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg"
          >
            Login to Register
          </button>
        )}
      </div>
    </div>
  );
}
