import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import apiClient from '../utils/apiClient';
import { fromLocalInputValue, toLocalInputValue } from '../utils/dates';
import LocationAutocomplete from '../components/LocationAutocomplete';

import CategoryEditor, { categoriesError, toApiCategories, totalCapacity } from '../components/events/CategoryEditor';
import EventImagesEditor from '../components/events/EventImagesEditor';

export default function EditEvent() {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Pictures are saved on their own (EventImagesEditor), not with the form below.
  const [images, setImages] = useState({ cover_image: null, info_images: [] });
  const location = useLocation();
  const justCreated = new URLSearchParams(location.search).get('new') === '1';
  const [formData, setFormData] = useState({
    event_name: '',
    description: '',
    date: '',
    location: '',
    capacity: '',
    kit_cutoff_date: '',
    categories: [],
  });


  useEffect(() => {
    fetchEventData();
  }, [eventId]);

  // Coming from "Create event": jump to the Pictures section once loaded.
  useEffect(() => {
    if (!loading && location.hash === '#pictures') {
      document.getElementById('pictures')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [loading, location.hash]);

  const fetchEventData = async () => {
    try {
      const response = await apiClient.get(`/events/${eventId}`);
      const event = response.data.event;

      setFormData({
        event_name: event.event_name,
        description: event.description,
        date: toLocalInputValue(event.date), // was substring(0,16) of UTC: shifted 8 h on every save
        location: event.location,
        capacity: event.capacity,
        kit_cutoff_date: toLocalInputValue(event.kit_cutoff_date),
        // Older events have no per-category capacity yet: the organizer fills it in here.
        categories: (event.categories || []).map((c) => ({
          name: c.name,
          price: String(c.price),
          capacity: c.capacity ? String(c.capacity) : '',
        })),
      });

      setImages({ cover_image: event.cover_image || null, info_images: event.info_images || [] });
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
      await apiClient.put(`/events/${eventId}`, {
        event_name: formData.event_name,
        description: formData.description,
        date: fromLocalInputValue(formData.date), // with timezone, so the server can't misread it
        location: formData.location,
        categories: toApiCategories(formData.categories),
        capacity: totalCapacity(formData.categories), // the server recomputes it from the categories
        kit_cutoff_date: fromLocalInputValue(formData.kit_cutoff_date),
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
      <div className="bg-gradient-to-b from-slate-50 to-white min-h-screen py-12 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-block">
            <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-600 font-semibold">Loading event data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-slate-50 via-white to-orange-50 min-h-screen py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate(-1)} className="text-orange-600 hover:text-orange-700 font-bold mb-8 inline-block text-lg">
          ← Back
        </button>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-red-700 to-orange-600 p-8 text-white">
            <h1 className="text-4xl font-black mb-2">Edit Event</h1>
            <p className="text-orange-100">Update your event details and pricing</p>
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
                  placeholder="Describe your event..."
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

            {/* Submit Buttons */}
            <div className="pt-8 flex gap-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-4 px-6 rounded-lg shadow-lg hover:shadow-xl transition duration-300 disabled:opacity-50 transform hover:scale-105 text-lg uppercase tracking-wide"
              >
                {submitting ? 'Updating Event...' : 'Update Event'}
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

        {/* Pictures: cover + info pictures (saved immediately) */}
        <div className="bg-white rounded-2xl shadow-xl p-5 sm:p-8 mt-8">
          {justCreated && (
            <div className="bg-green-100 border-l-4 border-green-500 text-green-800 p-4 rounded-lg font-semibold mb-6">
              Event created and published! Add a cover picture and info pictures (kit, size chart, poster) below.
            </div>
          )}
          <EventImagesEditor
            eventId={eventId}
            coverImage={images.cover_image}
            infoImages={images.info_images}
            onChange={setImages}
          />
        </div>
      </div>
    </div>
  );
}
