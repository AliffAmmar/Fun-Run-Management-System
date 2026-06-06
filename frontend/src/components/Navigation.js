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
                <div className="absolute right-0 mt-2 w-48 bg-white text-gray-800 rounded-xl shadow-2xl hidden group-hover:block overflow-hidden">
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
