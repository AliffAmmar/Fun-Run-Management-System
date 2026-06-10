import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiClient from '../utils/apiClient';

export default function Navigation() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread notification count when user is logged in
  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      // Refresh unread count every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchUnreadCount = async () => {
    try {
      const response = await apiClient.get('/notifications/unread-count');
      setUnreadCount(response.data.unreadCount || 0);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-gradient-to-r from-slate-900 via-orange-600 to-red-700 text-white shadow-2xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <Link to="/" className="text-3xl font-black tracking-tight hover:text-orange-200 transition">
          🏃 RUN4FUN
        </Link>

        <div className="flex gap-6 items-center font-semibold">
          <Link to="/events" className="hover:text-orange-200 transition duration-300 text-sm uppercase tracking-wide">
            Events
          </Link>

          {user ? (
            <>
              <Link to="/notifications" className="relative hover:text-orange-200 transition duration-300 text-sm uppercase tracking-wide flex items-center gap-2">
                Notifications
                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-3 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>

              <Link to="/my-tickets" className="hover:text-orange-200 transition duration-300 text-sm uppercase tracking-wide">
                Tickets
              </Link>

              {user.role === 'organizer' && (
                <Link to="/manage-events" className="hover:text-orange-200 transition duration-300 text-sm uppercase tracking-wide">
                  My Events
                </Link>
              )}

              <div className="relative group">
                <button className="flex items-center gap-2 hover:text-orange-200 transition duration-300 text-sm uppercase tracking-wide">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center font-bold">
                    {user.name.charAt(0)}
                  </div>
                  {user.name}
                </button>
                <div className="absolute right-0 pt-2 w-48 hidden group-hover:block">
                <div className="bg-white text-gray-800 rounded-xl shadow-2xl overflow-hidden">
                  <Link to="/profile" className="block px-4 py-3 hover:bg-orange-50 font-medium transition">
                    Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-3 hover:bg-red-50 font-medium transition border-t"
                  >
                    Logout
                  </button>
                </div>
              </div>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:text-orange-200 transition duration-300 text-sm uppercase tracking-wide">
                Login
              </Link>
              <Link
                to="/register"
                className="bg-gradient-to-r from-orange-400 to-red-500 text-white px-6 py-2 rounded-full font-bold hover:shadow-lg transition duration-300 text-sm uppercase tracking-wide"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
