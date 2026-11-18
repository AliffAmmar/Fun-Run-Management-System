import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiClient from '../utils/apiClient';

export default function Navigation() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false); // phone menu (☰)
  const [profileOpen, setProfileOpen] = useState(false); // laptop profile dropdown
  const profileRef = useRef(null);

  // Close menus when the page changes.
  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  // Close the profile dropdown when tapping/clicking elsewhere.
  useEffect(() => {
    if (!profileOpen) return undefined;
    const onDown = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [profileOpen]);

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

  // One list of links, shown as a row on laptops and in the ☰ menu on phones.
  const role = user?.role;
  const links = [
    { to: '/events', label: 'Events', show: true },
    { to: '/my-tickets', label: 'My Tickets', show: Boolean(user) && role !== 'organizer' },
    { to: '/event-day', label: 'Event Day', show: ['organizer', 'admin'].includes(role) },
    { to: '/manage-events', label: 'My Events', show: role === 'organizer' },
    { to: '/reports', label: 'Reports', show: ['organizer', 'admin'].includes(role) },
    { to: '/admin/users', label: 'Users', show: role === 'admin' },
  ].filter((l) => l.show);

  const desktopLink = ({ isActive }) =>
    `text-sm uppercase tracking-wide transition hover:text-orange-200 ${isActive ? 'text-orange-200' : ''}`;
  const mobileLink = ({ isActive }) =>
    `block px-4 py-3 rounded-lg font-bold ${isActive ? 'bg-white/20' : 'hover:bg-white/10'}`;

  const Bell = () => (
    <Link to="/notifications" aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`} className="relative p-2 -m-2">
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 01-3.4 0" />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 px-1 flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );

  return (
    <nav className="bg-gradient-to-r from-slate-900 via-orange-600 to-red-700 text-white shadow-2xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 lg:py-4 flex justify-between items-center gap-4">
        <Link to="/" className="text-2xl lg:text-3xl font-black tracking-tight hover:text-orange-200 transition">
          RUN4FUN
        </Link>

        {/* ---- Laptop: one row ---- */}
        <div className="hidden lg:flex gap-6 items-center font-semibold">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={desktopLink}>
              {l.label}
            </NavLink>
          ))}
          {user ? (
            <>
              <Bell />
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen((o) => !o)}
                  aria-expanded={profileOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 hover:text-orange-200 transition text-sm uppercase tracking-wide"
                >
                  <span className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center font-bold">
                    {user.name.charAt(0)}
                  </span>
                  {user.name}
                  <span aria-hidden="true">▾</span>
                </button>
                {profileOpen && (
                  <div role="menu" className="absolute right-0 mt-2 w-48 bg-white text-gray-800 rounded-xl shadow-2xl overflow-hidden">
                    <Link to="/profile" role="menuitem" className="block px-4 py-3 hover:bg-orange-50 font-medium transition">
                      Profile
                    </Link>
                    <button role="menuitem" onClick={handleLogout} className="block w-full text-left px-4 py-3 hover:bg-red-50 font-medium transition border-t">
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <NavLink to="/login" className={desktopLink}>
                Login
              </NavLink>
              <Link
                to="/register"
                className="bg-gradient-to-r from-orange-400 to-red-500 text-white px-6 py-2 rounded-full font-bold hover:shadow-lg transition text-sm uppercase tracking-wide"
              >
                Register
              </Link>
            </>
          )}
        </div>

        {/* ---- Phone: bell + ☰ ---- */}
        <div className="flex lg:hidden items-center gap-5">
          {user ? (
            <Bell />
          ) : (
            <Link to="/login" className="text-sm font-bold uppercase tracking-wide">
              Login
            </Link>
          )}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="p-2 -m-2"
          >
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div id="mobile-menu" className="lg:hidden border-t border-white/20 px-4 pb-4 pt-2 space-y-1">
          {user && (
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-black">{user.name.charAt(0)}</span>
              <span>
                <span className="block font-bold">{user.name}</span>
                <span className="block text-xs uppercase tracking-wide text-orange-100">{role}</span>
              </span>
            </div>
          )}
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={mobileLink}>
              {l.label}
            </NavLink>
          ))}
          {user ? (
            <>
              <NavLink to="/notifications" className={mobileLink}>
                Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
              </NavLink>
              <NavLink to="/profile" className={mobileLink}>
                Profile
              </NavLink>
              <button onClick={handleLogout} className="block w-full text-left px-4 py-3 rounded-lg font-bold hover:bg-white/10">
                Logout
              </button>
            </>
          ) : (
            <NavLink to="/register" className={mobileLink}>
              Create account
            </NavLink>
          )}
        </div>
      )}
    </nav>
  );
}
