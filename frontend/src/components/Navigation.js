import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navigation() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold">
          🏃 Run4Fun
        </Link>

        <div className="flex gap-4 items-center">
          <Link to="/events" className="hover:text-blue-100">
            Browse Events
          </Link>

          {user ? (
            <>
              <Link to="/my-tickets" className="hover:text-blue-100">
                My Tickets
              </Link>

              {user.role === 'organizer' && (
                <Link to="/create-event" className="hover:text-blue-100">
                  Create Event
                </Link>
              )}

              <div className="relative group">
                <button className="hover:text-blue-100">{user.name}</button>
                <div className="absolute right-0 mt-2 w-48 bg-white text-gray-800 rounded-lg shadow-lg hidden group-hover:block">
                  <Link to="/profile" className="block px-4 py-2 hover:bg-gray-100">
                    Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:text-blue-100">
                Login
              </Link>
              <Link
                to="/register"
                className="bg-white text-blue-500 px-4 py-2 rounded hover:bg-blue-100"
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
