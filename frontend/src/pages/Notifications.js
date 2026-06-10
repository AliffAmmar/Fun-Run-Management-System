import React, { useState, useEffect } from 'react';
import apiClient from '../utils/apiClient';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'unread'

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiClient.get('/notifications');
      setNotifications(response.data.data || []);
    } catch (err) {
      setError('Failed to load notifications');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await apiClient.put(`/notifications/${notificationId}/read`);
      setNotifications(
        notifications.map((notif) =>
          notif._id === notificationId ? { ...notif, isRead: true } : notif
        )
      );
      // Update selected notification if it's the one being marked
      if (selectedNotification?._id === notificationId) {
        setSelectedNotification({ ...selectedNotification, isRead: true });
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiClient.put('/notifications/mark-all/read');
      setNotifications(notifications.map((notif) => ({ ...notif, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await apiClient.delete(`/notifications/${notificationId}`);
      setNotifications(notifications.filter((notif) => notif._id !== notificationId));
      if (selectedNotification?._id === notificationId) {
        setSelectedNotification(null);
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const deleteAllNotifications = async () => {
    if (window.confirm('Are you sure you want to delete all notifications?')) {
      try {
        await apiClient.delete('/notifications');
        setNotifications([]);
        setSelectedNotification(null);
      } catch (err) {
        console.error('Failed to delete all notifications:', err);
      }
    }
  };

  const filteredNotifications =
    activeTab === 'unread' ? notifications.filter((n) => !n.isRead) : notifications;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'welcome':
        return '';
      case 'event_created':
        return '';
      case 'registration_confirmed':
        return '';
      case 'participant_joined':
        return '';
      default:
        return '';
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'welcome':
        return 'bg-blue-50 border-blue-200';
      case 'event_created':
        return 'bg-green-50 border-green-200';
      case 'registration_confirmed':
        return 'bg-purple-50 border-purple-200';
      case 'participant_joined':
        return 'bg-orange-50 border-orange-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Notifications</h1>
          <p className="text-gray-600">
            {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
            <p className="mt-4 text-gray-600">Loading notifications...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Notifications List */}
            <div className="lg:col-span-2">
              {/* Tabs */}
              <div className="mb-6 flex gap-4 border-b border-gray-300">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`pb-4 px-2 font-semibold transition-colors ${
                    activeTab === 'all'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  onClick={() => setActiveTab('unread')}
                  className={`pb-4 px-2 font-semibold transition-colors ${
                    activeTab === 'unread'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
              </div>

              {/* Action Buttons */}
              {notifications.length > 0 && (
                <div className="mb-6 flex gap-4">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium text-sm"
                    >
                      Mark All as Read
                    </button>
                  )}
                  <button
                    onClick={deleteAllNotifications}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium text-sm"
                  >
                    Delete All
                  </button>
                </div>
              )}

              {/* Notifications List */}
              <div className="space-y-4">
                {filteredNotifications.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                    <p className="text-gray-500 text-lg">
                      {activeTab === 'unread'
                        ? 'No unread notifications'
                        : 'No notifications yet'}
                    </p>
                  </div>
                ) : (
                  filteredNotifications.map((notification) => (
                    <div
                      key={notification._id}
                      className={`bg-white rounded-lg border-l-4 p-4 transition-all ${
                        getNotificationColor(notification.type)
                      } ${
                        !notification.isRead ? 'border-l-blue-600 shadow-sm' : 'border-l-gray-300'
                      } ${
                        selectedNotification?._id === notification._id ? 'ring-2 ring-blue-400' : ''
                      }`}
                    >
                      <div
                        onClick={() => setSelectedNotification(notification)}
                        className="cursor-pointer hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <span className="text-2xl mt-1">{getNotificationIcon(notification.type)}</span>
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900">{notification.title}</h3>
                              <p className="text-gray-700 mt-1">{notification.message}</p>
                              <p className="text-xs text-gray-500 mt-2">
                                {new Date(notification.createdAt).toLocaleDateString()}{' '}
                                {new Date(notification.createdAt).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                          {!notification.isRead && (
                            <div className="w-3 h-3 bg-blue-600 rounded-full mt-2 ml-2 flex-shrink-0"></div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
                        {!notification.isRead && (
                          <button
                            onClick={() => markAsRead(notification._id)}
                            className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors font-medium text-sm"
                          >
                            Mark Read
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification._id)}
                          className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors font-medium text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Details Sidebar */}
            <div className="lg:col-span-1">
              {selectedNotification ? (
                <div className="bg-white rounded-lg border border-gray-300 p-6 sticky top-8">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-4xl">{getNotificationIcon(selectedNotification.type)}</span>
                    {!selectedNotification.isRead && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                        Unread
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl font-bold text-gray-900 mb-2">{selectedNotification.title}</h2>
                  <p className="text-sm text-gray-500 mb-4">
                    {new Date(selectedNotification.createdAt).toLocaleDateString()} at{' '}
                    {new Date(selectedNotification.createdAt).toLocaleTimeString()}
                  </p>

                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {selectedNotification.fullMessage || selectedNotification.message}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {!selectedNotification.isRead && (
                      <button
                        onClick={() => markAsRead(selectedNotification._id)}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        Mark as Read
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(selectedNotification._id)}
                      className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                    >
                      Delete Notification
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-300 p-6 text-center">
                  <p className="text-gray-500 text-sm">
                    Select a notification to view details
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
