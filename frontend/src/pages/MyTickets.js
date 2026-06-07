import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../utils/apiClient';

export default function MyTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/tickets/my-tickets');
      setTickets(response.data.tickets);
    } catch (err) {
      setError('Failed to load tickets');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-b from-slate-50 via-white to-orange-50 min-h-screen py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <button onClick={() => navigate(-1)} className="text-orange-600 hover:text-orange-700 font-bold mb-8 inline-block text-lg">
          ← Back
        </button>

        <div className="mb-12">
          <h1 className="text-4xl font-black text-slate-900 mb-2">My Tickets</h1>
          <p className="text-lg text-slate-600">Your registered events and QR codes</p>
        </div>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 px-6 py-4 rounded-lg mb-8 font-semibold">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block">
              <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mb-4"></div>
              <p className="text-slate-600 font-semibold">Loading your tickets...</p>
            </div>
          </div>
        ) : tickets.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center border-t-4 border-orange-500">
            <div className="text-6xl mb-4">🎫</div>
            <p className="text-2xl text-slate-900 font-bold mb-2">No tickets yet</p>
            <p className="text-slate-600 mb-8">Register for events to get your tickets and QR codes</p>
            <button
              onClick={() => navigate('/events')}
              className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-3 px-8 rounded-full shadow-lg hover:shadow-xl transition duration-300 transform hover:scale-105 text-lg uppercase tracking-wide"
            >
              Browse Events
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {tickets.map((ticket) => (
              <div
                key={ticket._id}
                className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition duration-300 overflow-hidden border-l-4 border-orange-500"
              >
                <div className="flex flex-col md:flex-row">
                  {/* Info Section */}
                  <div className="flex-1 p-8">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-2xl font-black text-slate-900 mb-4">
                          {ticket.registration_id?.event_id?.event_name}
                        </h3>
                      </div>
                      <span
                        className={`px-6 py-2 rounded-full text-sm font-bold whitespace-nowrap ml-4 border-2 ${
                          ticket.check_in_status
                            ? 'bg-green-100 border-green-300 text-green-800'
                            : 'bg-orange-100 border-orange-300 text-orange-800'
                        }`}
                      >
                        {ticket.check_in_status ? '✓ Checked In' : 'Pending'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1 tracking-wide">Date & Time</p>
                        <p className="font-bold text-slate-900 text-lg">
                          {new Date(ticket.registration_id?.event_id?.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="text-sm text-orange-600 font-semibold">
                          {new Date(ticket.registration_id?.event_id?.date).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1 tracking-wide">Location</p>
                        <p className="font-bold text-slate-900 text-lg">
                          {ticket.registration_id?.event_id?.location}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1 tracking-wide">Ticket Code</p>
                        <p className="font-mono font-black text-slate-900 text-lg bg-slate-100 px-3 py-2 rounded-lg">
                          {ticket.ticket_code}
                        </p>
                      </div>
                    </div>

                    {/* ===== NEW: Registration Type & Team Info ===== */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {/* Registration Type Badge */}
                      <div className="bg-slate-50 p-4 rounded-lg border-2 border-blue-200">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-2 tracking-wide">Registration Type</p>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">
                            {ticket.registration_type === 'individual' ? '👤' : '👥'}
                          </span>
                          <p className="font-bold text-slate-900 text-lg capitalize">
                            {ticket.registration_type}
                          </p>
                        </div>
                      </div>

                      {/* Race Category (Individual only) */}
                      {ticket.registration_type === 'individual' && (
                        <div className="bg-slate-50 p-4 rounded-lg border-2 border-green-200">
                          <p className="text-xs font-bold text-slate-500 uppercase mb-2 tracking-wide">Race Category</p>
                          <p className="font-bold text-slate-900 text-lg">
                            {ticket.registration_id?.race_category || 'N/A'}
                          </p>
                        </div>
                      )}

                      {/* Team Size (Team only) */}
                      {ticket.registration_type === 'team' && (
                        <div className="bg-slate-50 p-4 rounded-lg border-2 border-purple-200">
                          <p className="text-xs font-bold text-slate-500 uppercase mb-2 tracking-wide">Team Size</p>
                          <p className="font-bold text-slate-900 text-lg">
                            {ticket.team_size} Participants
                          </p>
                        </div>
                      )}
                    </div>

                    {/* ===== NEW: Shirt Size Breakdown (Team only) ===== */}
                    {ticket.registration_type === 'team' && ticket.shirt_sizes && Object.keys(ticket.shirt_sizes).length > 0 && (
                      <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200 mb-4">
                        <p className="text-xs font-bold text-slate-600 uppercase mb-3 tracking-wide">📊 Shirt Size Distribution</p>
                        <div className="grid grid-cols-3 gap-3">
                          {Object.entries(ticket.shirt_sizes).map(([size, qty]) => (
                            <div key={size} className="bg-white p-3 rounded border border-green-300 text-center">
                              <p className="text-xs font-bold text-slate-600 uppercase mb-1">{size}</p>
                              <p className="text-2xl font-black text-green-600">{qty}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Check-in Date */}
                    {ticket.check_in_status && ticket.check_in_date && (
                      <div className="bg-green-50 p-3 rounded-lg border-2 border-green-200">
                        <p className="text-xs font-bold text-slate-600 uppercase mb-1">Checked In</p>
                        <p className="font-semibold text-green-700">
                          {new Date(ticket.check_in_date).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* QR Code Section */}
                  <div className="bg-gradient-to-br from-slate-50 to-orange-50 p-8 flex items-center justify-center md:w-64 border-t-2 md:border-t-0 md:border-l-2 border-slate-200">
                    {ticket.qr_code ? (
                      <div className="text-center">
                        <p className="text-xs font-bold text-slate-600 uppercase mb-3 tracking-wide">Show to Staff</p>
                        <img
                          src={ticket.qr_code}
                          alt="QR Code"
                          className="w-48 h-48 border-4 border-white rounded-lg shadow-lg"
                        />
                      </div>
                    ) : (
                      <p className="text-slate-500 font-semibold">QR Code not available</p>
                    )}
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