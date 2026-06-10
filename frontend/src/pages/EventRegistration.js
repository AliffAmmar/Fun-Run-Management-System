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

  // ===== Registration type state =====
  const [registrationType, setRegistrationType] = useState('individual');

  const [formData, setFormData] = useState({
    race_category: '',
    shirt_size: 'M',
    emergency_contact: '',
    team_name: '',
  });

  // ===== Shirt sizes for team registration =====
  const [shirtSizes, setShirtSizes] = useState({
    XS: 0,
    S: 0,
    M: 0,
    L: 0,
    XL: 0,
    XXL: 0,
  });

  const shirtSizeOptions = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

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

  // ===== Calculate team size from shirt sizes =====
  const calculateTeamSize = () => {
    return Object.values(shirtSizes).reduce((sum, qty) => sum + qty, 0);
  };

  // ===== Calculate total price =====
  const calculateTotalPrice = () => {
    if (registrationType === 'individual') {
      return selectedPrice;
    } else {
      return selectedPrice * calculateTeamSize();
    }
  };

  // ===== Handle shirt size change =====
  const handleShirtSizeChange = (size, quantity) => {
    setShirtSizes((prev) => ({
      ...prev,
      [size]: Math.max(0, quantity),
    }));
  };

  const handleRegistration = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      // ===== VALIDATION =====
      if (registrationType === 'individual') {
        if (!formData.race_category || !formData.shirt_size || !formData.emergency_contact) {
          setError('Please fill in all required fields');
          setSubmitting(false);
          return;
        }
      } else if (registrationType === 'team') {
        if (!formData.race_category || !formData.team_name || !formData.emergency_contact || calculateTeamSize() < 2) {
          setError('Please fill in all required fields and ensure team has at least 2 participants');
          setSubmitting(false);
          return;
        }
      }

      // ===== BUILD PAYLOAD =====
      const payload = {
        event_id: eventId,
        registration_type: registrationType,
        race_category: formData.race_category,
        emergency_contact: formData.emergency_contact,
      };

      if (registrationType === 'individual') {
        payload.shirt_size = formData.shirt_size;
      } else {
        payload.team_name = formData.team_name;
        payload.shirt_sizes = shirtSizes;
      }

      // ===== SEND TO BACKEND =====
      const response = await apiClient.post('/registrations', payload);
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
        amount: calculateTotalPrice(),
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
                {/* ===== Registration Type Toggle ===== */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-4 uppercase tracking-wide">Registration Type *</label>
                  <div className="flex gap-6 bg-slate-50 p-4 rounded-lg border-2 border-slate-200">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="registration_type"
                        value="individual"
                        checked={registrationType === 'individual'}
                        onChange={(e) => setRegistrationType(e.target.value)}
                        className="w-5 h-5 accent-orange-600 cursor-pointer"
                      />
                      <span className="font-semibold text-slate-700">Individual</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="registration_type"
                        value="team"
                        checked={registrationType === 'team'}
                        onChange={(e) => setRegistrationType(e.target.value)}
                        className="w-5 h-5 accent-orange-600 cursor-pointer"
                      />
                      <span className="font-semibold text-slate-700">Team (Bulk)</span>
                    </label>
                  </div>
                </div>

                {/* ===== INDIVIDUAL SECTION ===== */}
                {registrationType === 'individual' && (
                  <div className="space-y-6 bg-blue-50 p-6 rounded-lg border-2 border-blue-200">
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
                  </div>
                )}

                {/* ===== TEAM SECTION ===== */}
                {registrationType === 'team' && (
                  <div className="space-y-6 bg-green-50 p-6 rounded-lg border-2 border-green-200">
                    {/* Race Category for Team */}
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
                            {cat.name} - RM {cat.price.toFixed(2)} per person
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Team Name */}
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Organization / Team Name *</label>
                      <input
                        type="text"
                        name="team_name"
                        value={formData.team_name}
                        onChange={handleChange}
                        required
                        placeholder="Enter your organization or team name"
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 transition text-lg"
                      />
                    </div>

                    {/* Emergency Contact for Team */}
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Emergency Contact (Team Leader) *</label>
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

                    {/* Shirt Sizes */}
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-4 uppercase tracking-wide">Select Shirt Sizes *</label>
                      <div className="grid grid-cols-3 gap-4">
                        {shirtSizeOptions.map((size) => (
                          <div key={size} className="flex flex-col items-center bg-white p-4 rounded-lg border-2 border-slate-200">
                            <p className="text-sm font-bold text-slate-600 mb-3 uppercase">{size}</p>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleShirtSizeChange(size, shirtSizes[size] - 1)}
                                className="bg-red-500 hover:bg-red-600 text-white w-8 h-8 rounded font-bold transition"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                value={shirtSizes[size]}
                                onChange={(e) => handleShirtSizeChange(size, parseInt(e.target.value) || 0)}
                                min="0"
                                className="w-14 text-center border-2 border-slate-200 rounded py-2 font-bold text-lg"
                              />
                              <button
                                type="button"
                                onClick={() => handleShirtSizeChange(size, shirtSizes[size] + 1)}
                                className="bg-green-500 hover:bg-green-600 text-white w-8 h-8 rounded font-bold transition"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Team Summary */}
                      <div className="mt-6 bg-white p-4 rounded-lg border-2 border-orange-300">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm text-slate-600 font-semibold">Total Participants:</p>
                            <p className="text-3xl font-black text-blue-600">{calculateTeamSize()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate-600 font-semibold">Unit Price:</p>
                            <p className="text-2xl font-bold text-slate-900">RM {selectedPrice.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Price Summary */}
                <div className="bg-gradient-to-br from-orange-100 to-red-100 border-2 border-orange-300 p-6 rounded-xl">
                  <p className="text-sm font-bold text-slate-700 uppercase mb-2 tracking-wide">Estimated Total</p>
                  <p className="text-4xl font-black bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                    RM {calculateTotalPrice().toFixed(2)}
                  </p>
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
                    RM {calculateTotalPrice().toFixed(2)}
                  </p>
                  <p className="text-sm text-slate-700 font-semibold mt-4">
                    {registrationType === 'individual' 
                      ? `${formData.race_category}` 
                      : `${formData.team_name} • ${formData.race_category} • ${calculateTeamSize()} participants`
                    }
                  </p>
                </div>

                <div className="bg-slate-50 p-6 rounded-lg border-2 border-slate-200">
                  <p className="text-slate-700 font-semibold mb-3">Secure Payment</p>
                  <p className="text-slate-600 mb-4">
                    Click the button below to complete your payment. This is a mock payment and will be automatically marked as successful.
                  </p>
                </div>

                <button
                  onClick={handlePayment}
                  disabled={submitting}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 px-6 rounded-lg shadow-lg hover:shadow-xl transition duration-300 disabled:opacity-50 transform hover:scale-105 text-lg uppercase tracking-wide"
                >
                  {submitting ? 'Processing Payment...' : 'Complete Payment'}
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
                  
                  {/* Show ticket type info */}
                  <div className="mt-6 bg-white p-4 rounded-lg border-2 border-blue-300">
                    <p className="text-sm font-semibold text-slate-600 mb-2">Registration Type:</p>
                    <p className="text-lg font-bold text-blue-600">
                      {ticketData.registration_type === 'individual' ? 'Individual' : `Team - ${ticketData.team_size} Participants`}
                    </p>
                    <p className="text-sm font-semibold text-slate-600 mt-3 mb-1">Race Category:</p>
                    <p className="text-lg font-bold text-blue-600">
                      {ticketData.race_category}
                    </p>
                  </div>
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