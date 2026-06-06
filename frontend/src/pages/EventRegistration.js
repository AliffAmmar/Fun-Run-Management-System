import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../utils/apiClient';

export default function EventRegistration() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [registrationId, setRegistrationId] = useState(null);
  const [ticketData, setTicketData] = useState(null);
  const [selectedPrice, setSelectedPrice] = useState(0);

  const [formData, setFormData] = useState({
    race_category: '',
    registration_category: '',
    shirt_size: 'M',
    emergency_contact: '',
    team_name: '',
  });

  useEffect(() => {
    fetchEvent();
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      const response = await apiClient.get(`/events/${eventId}`);
      setEvent(response.data.event);
      if (response.data.event.categories && response.data.event.categories.length > 0) {
        setSelectedPrice(response.data.event.categories[0].price);
        setFormData((prev) => ({
          ...prev,
          race_category: response.data.event.categories[0].name,
        }));
      }
    } catch (err) {
      setError('Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  const handleRegistration = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await apiClient.post('/registrations', {
        event_id: eventId,
        category: formData.registration_category,
        race_category: formData.race_category,
        shirt_size: formData.shirt_size,
        emergency_contact: formData.emergency_contact,
        team_name: formData.team_name,
      });
      setRegistrationId(response.data.registration._id);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayment = async () => {
    setSubmitting(true);
    setError('');

    try {
      await apiClient.post('/payments', {
        registration_id: registrationId,
        amount: selectedPrice,
        payment_method: 'credit_card',
      });

      const ticketResponse = await apiClient.post('/tickets/generate', {
        registration_id: registrationId,
      });

      setTicketData(ticketResponse.data.ticket);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === 'race_category' && event?.categories) {
      const selectedCat = event.categories.find((cat) => cat.name === value);
      if (selectedCat) {
        setSelectedPrice(selectedCat.price);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-semibold">Loading registration form...</p>
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
            <h1 className="text-3xl font-black mb-2">Register for {event?.event_name}</h1>
            <p className="text-orange-100">Complete your registration in 3 easy steps</p>
          </div>

          <div className="p-8">
            {error && (
              <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-8 font-semibold">
                {error}
              </div>
            )}

            {/* Step Indicator */}
            <div className="flex justify-between mb-12">
              <div className={`flex-1 text-center pb-4 border-b-4 transition ${step >= 1 ? 'border-orange-600' : 'border-slate-200'}`}>
                <div className={`w-10 h-10 mx-auto mb-2 rounded-full flex items-center justify-center font-bold text-white transition ${step >= 1 ? 'bg-gradient-to-r from-orange-500 to-red-600' : 'bg-slate-300'}`}>
                  1
                </div>
                <p className={`font-bold uppercase tracking-wide text-sm ${step >= 1 ? 'text-orange-600' : 'text-slate-500'}`}>Registration</p>
              </div>
              <div className={`flex-1 text-center pb-4 border-b-4 transition ${step >= 2 ? 'border-orange-600' : 'border-slate-200'}`}>
                <div className={`w-10 h-10 mx-auto mb-2 rounded-full flex items-center justify-center font-bold text-white transition ${step >= 2 ? 'bg-gradient-to-r from-orange-500 to-red-600' : 'bg-slate-300'}`}>
                  2
                </div>
                <p className={`font-bold uppercase tracking-wide text-sm ${step >= 2 ? 'text-orange-600' : 'text-slate-500'}`}>Payment</p>
              </div>
              <div className={`flex-1 text-center pb-4 border-b-4 transition ${step >= 3 ? 'border-orange-600' : 'border-slate-200'}`}>
                <div className={`w-10 h-10 mx-auto mb-2 rounded-full flex items-center justify-center font-bold text-white transition ${step >= 3 ? 'bg-gradient-to-r from-orange-500 to-red-600' : 'bg-slate-300'}`}>
                  3
                </div>
                <p className={`font-bold uppercase tracking-wide text-sm ${step >= 3 ? 'text-orange-600' : 'text-slate-500'}`}>Ticket</p>
              </div>
            </div>

            {/* Step 1: Registration Form */}
            {step === 1 && (
              <form onSubmit={handleRegistration} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Race Category *</label>
                  <select
                    name="race_category"
                    value={formData.race_category}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 transition text-lg"
                  >
                    {event?.categories?.map((cat) => (
                      <option key={cat.name} value={cat.name}>
                        {cat.name} - RM {cat.price.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Registration Type *</label>
                  <input
                    type="text"
                    name="registration_category"
                    value={formData.registration_category}
                    onChange={handleChange}
                    required
                    placeholder="e.g., Individual, Team"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 transition text-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Shirt Size *</label>
                  <select
                    name="shirt_size"
                    value={formData.shirt_size}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 transition text-lg"
                  >
                    <option value="XS">XS - Extra Small</option>
                    <option value="S">S - Small</option>
                    <option value="M">M - Medium</option>
                    <option value="L">L - Large</option>
                    <option value="XL">XL - Extra Large</option>
                    <option value="XXL">XXL - 2XL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Emergency Contact *</label>
                  <input
                    type="text"
                    name="emergency_contact"
                    value={formData.emergency_contact}
                    onChange={handleChange}
                    required
                    placeholder="Phone number"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 transition text-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Team Name (Optional)</label>
                  <input
                    type="text"
                    name="team_name"
                    value={formData.team_name}
                    onChange={handleChange}
                    placeholder="If registering as a team"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 transition text-lg"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-4 px-6 rounded-lg shadow-lg hover:shadow-xl transition duration-300 disabled:opacity-50 transform hover:scale-105 text-lg uppercase tracking-wide mt-8"
                >
                  {submitting ? 'Processing...' : 'Proceed to Payment →'}
                </button>
              </form>
            )}

            {/* Step 2: Payment */}
            {step === 2 && (
              <div className="space-y-8">
                <div className="bg-gradient-to-br from-orange-100 to-red-100 border-2 border-orange-300 p-8 rounded-xl">
                  <p className="text-sm font-bold text-slate-700 uppercase mb-3 tracking-wide">Total Amount Due</p>
                  <p className="text-5xl font-black bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-2">
                    RM {selectedPrice.toFixed(2)}
                  </p>
                  <p className="text-sm text-slate-700 font-semibold mt-4">
                    {formData.race_category} • {formData.registration_category}
                  </p>
                </div>

                <div className="bg-slate-50 p-6 rounded-lg border-2 border-slate-200">
                  <p className="text-slate-700 font-semibold mb-3">🔒 Secure Payment</p>
                  <p className="text-slate-600 mb-4">
                    Click the button below to complete your payment. This is a mock payment and will be automatically marked as successful.
                  </p>
                </div>

                <button
                  onClick={handlePayment}
                  disabled={submitting}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 px-6 rounded-lg shadow-lg hover:shadow-xl transition duration-300 disabled:opacity-50 transform hover:scale-105 text-lg uppercase tracking-wide"
                >
                  {submitting ? 'Processing Payment...' : '💳 Complete Payment'}
                </button>
              </div>
            )}

            {/* Step 3: Ticket */}
            {step === 3 && ticketData && (
              <div className="text-center space-y-8">
                <div className="bg-green-100 border-2 border-green-500 text-green-800 p-6 rounded-xl font-bold text-lg">
                  ✓ Payment successful and ticket generated!
                </div>

                <div className="bg-gradient-to-br from-slate-50 to-orange-50 p-8 rounded-xl border-2 border-slate-200">
                  <p className="text-sm font-bold text-slate-600 uppercase mb-6 tracking-wide">Present this QR Code</p>
                  {ticketData.qr_code && (
                    <img src={ticketData.qr_code} alt="QR Code" className="w-56 h-56 mx-auto mb-8 border-4 border-white rounded-lg shadow-lg" />
                  )}
                  <p className="text-xs font-bold text-slate-600 uppercase mb-2 tracking-wide">Ticket Code</p>
                  <p className="text-2xl font-mono font-black text-slate-900 bg-white px-4 py-3 rounded-lg border-2 border-orange-300">
                    {ticketData.ticket_code}
                  </p>
                </div>

                <div className="bg-blue-50 p-6 rounded-lg border-2 border-blue-200">
                  <p className="text-slate-700 font-semibold text-sm">
                    📱 Save this page or your ticket. You'll need to present the QR code on the day of the event.
                  </p>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => navigate('/my-tickets')}
                    className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-4 px-6 rounded-lg shadow-lg hover:shadow-xl transition duration-300 transform hover:scale-105 uppercase tracking-wide"
                  >
                    View My Tickets
                  </button>
                  <button
                    onClick={() => navigate('/events')}
                    className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold py-4 px-6 rounded-lg transition duration-300 uppercase tracking-wide"
                  >
                    Browse More Events
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
