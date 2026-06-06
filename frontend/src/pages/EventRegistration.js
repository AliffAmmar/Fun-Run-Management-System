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
  const [step, setStep] = useState(1); // 1: Register, 2: Payment, 3: Ticket
  const [registrationId, setRegistrationId] = useState(null);
  const [ticketData, setTicketData] = useState(null);
  const [selectedPrice, setSelectedPrice] = useState(0);

  const [formData, setFormData] = useState({
    race_category: '', // The race category (5K, 10K, etc.)
    registration_category: '', // How they're registering (Individual, Team)
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
      // Set initial price from first category
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
      // Process payment
      await apiClient.post('/payments', {
        registration_id: registrationId,
        amount: selectedPrice,
        payment_method: 'credit_card',
      });

      // Generate ticket
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

    // If race category changed, update the price
    if (name === 'race_category' && event?.categories) {
      const selectedCat = event.categories.find((cat) => cat.name === value);
      if (selectedCat) {
        setSelectedPrice(selectedCat.price);
      }
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-8">
        <button onClick={() => navigate(-1)} className="text-blue-500 hover:underline mb-4">
          ← Back
        </button>

        <h1 className="text-3xl font-bold mb-6">Register for {event?.event_name}</h1>

        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

        {/* Step Indicator */}
        <div className="flex justify-between mb-8">
          <div className={`flex-1 text-center pb-4 border-b-2 ${step >= 1 ? 'border-blue-500' : 'border-gray-300'}`}>
            <p className={`font-semibold ${step >= 1 ? 'text-blue-500' : 'text-gray-500'}`}>1. Registration</p>
          </div>
          <div className={`flex-1 text-center pb-4 border-b-2 ${step >= 2 ? 'border-blue-500' : 'border-gray-300'}`}>
            <p className={`font-semibold ${step >= 2 ? 'text-blue-500' : 'text-gray-500'}`}>2. Payment</p>
          </div>
          <div className={`flex-1 text-center pb-4 border-b-2 ${step >= 3 ? 'border-blue-500' : 'border-gray-300'}`}>
            <p className={`font-semibold ${step >= 3 ? 'text-blue-500' : 'text-gray-500'}`}>3. Ticket</p>
          </div>
        </div>

        {/* Step 1: Registration Form */}
        {step === 1 && (
          <form onSubmit={handleRegistration}>
            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2">Race Category *</label>
              <select
                name="race_category"
                value={formData.race_category}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              >
                {event?.categories?.map((cat) => (
                  <option key={cat.name} value={cat.name}>
                    {cat.name} - RM {cat.price.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2">Registration Type *</label>
              <input
                type="text"
                name="registration_category"
                value={formData.registration_category}
                onChange={handleChange}
                required
                placeholder="e.g., Individual, Team"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2">Shirt Size *</label>
              <select
                name="shirt_size"
                value={formData.shirt_size}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="XS">XS</option>
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
                <option value="XXL">XXL</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2">Emergency Contact *</label>
              <input
                type="text"
                name="emergency_contact"
                value={formData.emergency_contact}
                onChange={handleChange}
                required
                placeholder="Phone number"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 font-semibold mb-2">Team Name (Optional)</label>
              <input
                type="text"
                name="team_name"
                value={formData.team_name}
                onChange={handleChange}
                placeholder="Team name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50"
            >
              {submitting ? 'Processing...' : 'Proceed to Payment'}
            </button>
          </form>
        )}

        {/* Step 2: Payment */}
        {step === 2 && (
          <div>
            <div className="bg-gray-100 p-6 rounded-lg mb-6">
              <p className="text-gray-600 mb-2">Total Amount Due</p>
              <p className="text-3xl font-bold text-blue-600">RM {selectedPrice.toFixed(2)}</p>
              <p className="text-sm text-gray-600 mt-2">
                {formData.race_category} ({formData.registration_category})
              </p>
            </div>

            <p className="text-gray-700 mb-6">
              Click the button below to complete your payment. This is a mock payment and will be automatically marked as successful.
            </p>

            <button
              onClick={handlePayment}
              disabled={submitting}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50"
            >
              {submitting ? 'Processing Payment...' : 'Complete Payment'}
            </button>
          </div>
        )}

        {/* Step 3: Ticket */}
        {step === 3 && ticketData && (
          <div className="text-center">
            <div className="bg-green-100 text-green-700 p-4 rounded mb-6">
              ✓ Payment successful and ticket generated!
            </div>

            <div className="bg-gray-100 p-8 rounded-lg mb-6">
              <p className="text-gray-600 mb-4">Your QR Code</p>
              {ticketData.qr_code && (
                <img src={ticketData.qr_code} alt="QR Code" className="w-48 h-48 mx-auto mb-4" />
              )}
              <p className="text-lg font-bold text-gray-800">Ticket Code: {ticketData.ticket_code}</p>
            </div>

            <p className="text-gray-700 mb-6">
              Please save your ticket. You'll need to present this QR code on the day of the event.
            </p>

            <button
              onClick={() => navigate('/my-tickets')}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg"
            >
              View My Tickets
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
