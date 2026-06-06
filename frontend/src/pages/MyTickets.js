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
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate(-1)} className="text-blue-500 hover:underline mb-4">
          ← Back
        </button>

        <h1 className="text-4xl font-bold text-gray-800 mb-8">My Tickets</h1>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-600">Loading tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-lg shadow">
            <p className="text-gray-600 mb-4">You haven't registered for any events yet</p>
            <button
              onClick={() => navigate('/events')}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg"
            >
              Browse Events
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map((ticket) => (
              <div key={ticket._id} className="bg-white rounded-lg shadow p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                      {ticket.registration_id?.event_id?.event_name}
                    </h3>
                    <p className="text-gray-600 mb-1">
                      📅 {new Date(ticket.registration_id?.event_id?.date).toLocaleDateString()}
                    </p>
                    <p className="text-gray-600 mb-1">
                      📍 {ticket.registration_id?.event_id?.location}
                    </p>
                    <p className="text-gray-600 mb-1">
                      Ticket Code: <span className="font-semibold">{ticket.ticket_code}</span>
                    </p>
                    <p className={`mt-2 font-semibold ${ticket.check_in_status ? 'text-green-600' : 'text-orange-600'}`}>
                      {ticket.check_in_status ? '✓ Checked In' : 'Pending Check-In'}
                    </p>
                  </div>
                  <div className="md:w-48 flex items-center justify-center">
                    {ticket.qr_code && (
                      <img
                        src={ticket.qr_code}
                        alt="QR Code"
                        className="w-40 h-40 border-2 border-gray-300 rounded"
                      />
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
