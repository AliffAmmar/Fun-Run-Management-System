import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../utils/apiClient';
import LocationAutocomplete from '../components/LocationAutocomplete';

const CATEGORY_OPTIONS = ['5K', '10K', 'Half Marathon', 'Marathon', 'Family Run'];

export default function CreateEvent() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
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
      const response = await apiClient.post('/events', {
        event_name: formData.event_name,
        description: formData.description,
        date: formData.date,
        location: formData.location,
        categories: formData.categories,
        capacity: parseInt(formData.capacity),
      });

      await apiClient.post(`/events/${response.data.event._id}/publish`);
      navigate('/manage-events');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-gradient-to-b from-slate-50 via-white to-orange-50 min-h-screen py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="text-orange-600 hover:text-orange-700 font-bold mb-8 inline-block text-lg"
        >
          ← Back
        </button>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-red-700 to-orange-600 p-8 text-white">
            <h1 className="text-4xl font-black mb-2">Create New Event</h1>
            <p className="text-orange-100 text-lg">Create an amazing running experience for your community</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            {error && (
              <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg font-semibold">
                {error}
              </div>
            )}

            {/* Event Basics */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Event Details</h2>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Event Name *</label>
                <input
                  type="text"
                  name="event_name"
                  value={formData.event_name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 transition text-lg"
                  placeholder="Fun Run 2026"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Description *</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 transition resize-none"
                  placeholder="Describe your event, what participants can expect, highlights, etc..."
                  rows="4"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Date & Time *</label>
                  <input
                    type="datetime-local"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Location *</label>
                  <LocationAutocomplete value={formData.location} onChange={handleLocationChange} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Capacity *</label>
                <input
                  type="number"
                  name="capacity"
                  value={formData.capacity}
                  onChange={handleChange}
                  required
                  min="1"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 transition text-lg"
                  placeholder="Number of participants"
                />
              </div>
            </div>

            {/* Categories Section */}
            <div className="space-y-4 border-t-2 border-slate-200 pt-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Race Categories & Pricing</h2>

              <div className="bg-gradient-to-br from-slate-50 to-orange-50 p-6 rounded-xl border-2 border-orange-200 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Select Category</label>
                  <select
                    value={currentCategory}
                    onChange={(e) => setCurrentCategory(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 transition text-lg"
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Price (RM)</label>
                  <input
                    type="number"
                    value={currentPrice}
                    onChange={(e) => setCurrentPrice(e.target.value)}
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 transition text-lg"
                    placeholder="0.00"
                  />
                </div>

                <button
                  type="button"
                  onClick={addCategory}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 transform hover:scale-105 uppercase tracking-wide"
                >
                  + Add Category
                </button>
              </div>

              {/* Added Categories Display */}
              {formData.categories.length > 0 && (
                <div className="bg-white border-2 border-slate-200 rounded-xl p-6">
                  <p className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wide">Added Categories:</p>
                  <div className="space-y-3">
                    {formData.categories.map((cat, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center bg-gradient-to-r from-orange-100 to-red-100 p-4 rounded-lg border-2 border-orange-300"
                      >
                        <span className="font-bold text-slate-900 text-lg">
                          {cat.name} - RM {cat.price.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeCategory(idx)}
                          className="text-red-600 hover:text-red-800 font-bold text-lg transition"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-8 flex gap-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-4 px-6 rounded-lg shadow-lg hover:shadow-xl transition duration-300 disabled:opacity-50 transform hover:scale-105 text-lg uppercase tracking-wide"
              >
                {submitting ? 'Creating Event...' : 'Create & Publish Event'}
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold py-4 px-6 rounded-lg transition duration-300 text-lg uppercase tracking-wide"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
