import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navigation from './components/Navigation';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import EventsList from './pages/EventsList';
import EventDetail from './pages/EventDetail';
import EventRegistration from './pages/EventRegistration';
import MyTickets from './pages/MyTickets';
import CreateEvent from './pages/CreateEvent';
import ManageEvents from './pages/ManageEvents';
import EditEvent from './pages/EditEvent';
import Notifications from './pages/Notifications';
import Reports from './pages/Reports';
import EventReport from './pages/EventReport';
import Checkin from './pages/Checkin';
import EventDay from './pages/EventDay';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // Remember where the user was going (e.g. a scanned /checkin/FR-1012 link) so Login can
  // send them back there.
  return isAuthenticated ? children : <Navigate to="/login" state={{ from: location.pathname + location.search }} />;
};

const ReportRoleRoute = ({ children }) => {
  const { user } = useAuth();
  return ['organizer', 'admin'].includes(user?.role) ? children : <Navigate to="/events" replace />;
};

function AppContent() {
  return (
    <Router>
      <Navigation />
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/events" element={<EventsList />} />
        <Route path="/event/:id" element={<EventDetail />} />

        {/* Protected Routes */}
        <Route
          path="/register/:eventId"
          element={
            <ProtectedRoute>
              <EventRegistration />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-tickets"
          element={
            <ProtectedRoute>
              <MyTickets />
            </ProtectedRoute>
          }
        />
        <Route
          path="/checkin/:orderNo"
          element={
            <ProtectedRoute>
              <Checkin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/event-day"
          element={
            <ProtectedRoute>
              <ReportRoleRoute>
                <EventDay />
              </ReportRoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <ReportRoleRoute>
                <Reports />
              </ReportRoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/:eventId"
          element={
            <ProtectedRoute>
              <ReportRoleRoute>
                <EventReport />
              </ReportRoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-event"
          element={
            <ProtectedRoute>
              <CreateEvent />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manage-events"
          element={
            <ProtectedRoute>
              <ManageEvents />
            </ProtectedRoute>
          }
        />
        <Route
          path="/edit-event/:eventId"
          element={
            <ProtectedRoute>
              <EditEvent />
            </ProtectedRoute>
          }
        />

        {/* Redirect to events page */}
        <Route path="/" element={<Navigate to="/events" />} />
      </Routes>
    </Router>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
