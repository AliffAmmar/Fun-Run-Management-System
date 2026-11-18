import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../utils/apiClient';
import { fromLocalInputValue } from '../utils/dates';
import LocationAutocomplete from '../components/LocationAutocomplete';

import CategoryEditor, { categoriesError, toApiCategories, totalCapacity } from '../components/events/CategoryEditor';

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
    kit_cutoff_date: '',
    categories: [],
  });


  // Get today's date in the format required for datetime-local input (using local timezone)
  const getMinDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const date = String(today.getDate()).padStart(2, '0');
    const hours = String(today.getHours()).padStart(2, '0');
    const minutes = String(today.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${date}T${hours}:${minutes}`;
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
    // Each category has its own price and capacity; the event capacity is their total.
    const categoryProblem = categoriesError(formData.categories);
    if (categoryProblem) {
      setError(categoryProblem);
      return;
    }

    setSubmitting(true);

    try {
      const response = await apiClient.post('/events', {
        event_name: formData.event_name,
        description: formData.description,
        date: fromLocalInputValue(formData.date), // with timezone, so the server can't misread it
        location: formData.location,
        categories: toApiCategories(formData.categories),
        capacity: totalCapacity(formData.categories), // the server recomputes it from the categories
        kit_cutoff_date: fromLocalInputValue(formData.kit_cutoff_date),
      });

      await apiClient.post(`/events/${response.data.event._id}/publish`);
      // Next: add a cover and info pictures (they need the event to exist first).
      navigate(`/edit-event/${response.data.event._id}?new=1#pictures`);
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
                    min={getMinDate()}
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
                <p className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Total capacity</p>
                <p className="px-4 py-3 bg-slate-100 rounded-lg text-lg font-bold text-slate-900">
                  {totalCapacity(formData.categories)} runners
                  <span className="block text-sm font-normal text-slate-500">Set per category below</span>
                </p>
              </div>

              <div>
                <label htmlFor="kit_cutoff_date" className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">
                  Kit preparation cutoff (optional)
                </label>
                <input
                  id="kit_cutoff_date"
                  type="datetime-local"
                  name="kit_cutoff_date"
                  value={formData.kit_cutoff_date}
                  onChange={handleChange}
                  max={formData.date || undefined}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 transition"
                />
                <p className="text-sm text-slate-500 mt-1">
                  Last moment runners can change names and shirt sizes. Leave empty for 7 days before the event.
                </p>
              </div>
            </div>

            {/* Categories Section */}
            <div className="space-y-4 border-t-2 border-slate-200 pt-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Race Categories, Pricing & Capacity</h2>
              <p className="text-slate-600 mb-4">Each category has its own number of places. Prices and capacities can be changed later.</p>
              <CategoryEditor
                categories={formData.categories}
                onChange={(categories) => setFormData((prev) => ({ ...prev, categories }))}
              />
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
