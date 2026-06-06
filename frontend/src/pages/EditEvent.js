import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../utils/apiClient';
import LocationAutocomplete from '../components/LocationAutocomplete';

const CATEGORY_OPTIONS = ['5K', '10K', 'Half Marathon', 'Marathon', 'Family Run'];

export default function EditEvent() {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    event_name: '',
    description: '',
    date: '',
    location: '',
    capacity: '',
    categories: [],
  });

  const [currentCategory, setCurrentCategory] = useState('5K');
  const [currentPrice, setCurrentPrice] = useState('');

  useEffect(() => {
    fetchEventData();
  }, [eventId]);

  const fetchEventData = async () => {
    try {
      const response = await apiClient.get(`/events/${eventId}`);
      const event = response.data.event;

      setFormData({
        event_name: event.event_name,
        description: event.description,
        date: event.date.substring(0, 16), // Format for datetime-local
        location: event.location,
        capacity: event.capacity,
        categories: event.categories || [],
      });

      setLoading(false);
    } catch (err) {
      setError('Failed to load event data');
      console.error(err);
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLocationChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      location: value,
    }));
  };

  const addCategory = () => {
    if (!currentPrice || parseFloat(currentPrice) < 0) {
      setError('Please enter a valid price for the category');
      return;
    }

    // Check if category already added
    if (formData.categories.find((cat) => cat.name === currentCategory)) {
      setError('This category has already been added');
      return;
    }

    setFormData((prev) => ({
      ...prev,
      categories: [
        ...prev.categories,
        {
          name: currentCategory,
          price: parseFloat(currentPrice),
        },
      ],
    }));

    setCurrentPrice('');
    setError('');
  };

  const removeCategory = (index) => {
    setFormData((prev) => ({
      ...prev,
      categories: prev.categories.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.event_name.trim()) {
      setError('Event name is required');
      return;
    }
    if (!formData.description.trim()) {
      setError('Event description is required');
      return;
    }
    if (formData.categories.length === 0) {
      setError('Please add at least one category with price');
      return;
    }
    if (!formData.capacity || parseInt(formData.capacity) <= 0) {
      setError('Capacity must be greater than 0');
      return;
    }

    setSubmitting(true);

    try {
      await apiClient.put(`/events/${eventId}`, {
        event_name: formData.event_name,
        description: formData.description,
        date: formData.date,
        location: formData.location,
        categories: formData.categories,
        capacity: parseInt(formData.capacity),
      });

      navigate('/manage-events');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update event');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-8">
          <p className="text-gray-500">Loading event data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-8">
        <button onClick={() => navigate(-1)} className="text-blue-500 hover:underline mb-4">
          ← Back
        </button>

        <h1 className="text-3xl font-bold mb-6">Edit Event</h1>

        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">Event Name *</label>
            <input
              type="text"
              name="event_name"
              value={formData.event_name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              placeholder="Fun Run 2026"
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">Description *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              placeholder="Event description..."
              rows="4"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-gray-700 font-semibold mb-2">Date *</label>
              <input
                type="datetime-local"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-semibold mb-2">Location *</label>
              <LocationAutocomplete value={formData.location} onChange={handleLocationChange} />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">Capacity *</label>
            <input
              type="number"
              name="capacity"
              value={formData.capacity}
              onChange={handleChange}
              required
              min="1"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              placeholder="Number of participants"
            />
          </div>

          {/* Categories Section */}
          <div className="mb-6 border border-gray-300 rounded-lg p-4 bg-gray-50">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Event Categories & Pricing *</h3>

            <div className="grid grid-cols-1 gap-3 mb-4">
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Select Category</label>
                <select
                  value={currentCategory}
                  onChange={(e) => setCurrentCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Price (RM)</label>
                <input
                  type="number"
                  value={currentPrice}
                  onChange={(e) => setCurrentPrice(e.target.value)}
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>
              <button
                type="button"
                onClick={addCategory}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                + Add Category
              </button>
            </div>

            {/* Added Categories Display */}
            {formData.categories.length > 0 && (
              <div className="bg-white rounded-lg p-3">
                <p className="text-sm font-semibold text-gray-700 mb-3">Categories:</p>
                <div className="space-y-2">
                  {formData.categories.map((cat, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-gray-100 p-3 rounded">
                      <span className="font-medium text-gray-900">
                        {cat.name} - RM {cat.price.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeCategory(idx)}
                        className="text-red-500 hover:text-red-700 font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50"
          >
            {submitting ? 'Updating Event...' : 'Update Event'}
          </button>
        </form>
      </div>
    </div>
  );
}
