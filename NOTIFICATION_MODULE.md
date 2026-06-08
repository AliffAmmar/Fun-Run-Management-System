# Notification Module Documentation

## Overview
The notification module allows users to receive notifications about various events in the Run4Fun application. There are four types of notifications:

1. **Welcome Notifications** - Users receive this when they register
2. **Event Created Notifications** - All participants receive this when an organizer publishes a new event
3. **Registration Confirmed Notifications** - Participants receive this when their registration is confirmed after payment
4. **Participant Joined Notifications** - Organizers receive this when a participant registers for their event

## Architecture

### Backend

#### Model: Notification (models/Notification.js)
```
- user_id: ObjectId (ref: User)
- type: String (enum: welcome, event_created, registration_confirmed, participant_joined)
- title: String
- message: String
- fullMessage: String (optional, longer detailed version)
- relatedData: Object
  - eventId: ObjectId (ref: Event)
  - participantId: ObjectId (ref: User)
  - organizerId: ObjectId (ref: User)
- isRead: Boolean (default: false)
- timestamps: createdAt, updatedAt
```

#### Controller: notificationController.js
**Public Endpoints (require authentication):**
- `getNotifications()` - Get all notifications for the logged-in user
- `getUnreadCount()` - Get count of unread notifications
- `markAsRead(notificationId)` - Mark a single notification as read
- `markAllAsRead()` - Mark all notifications as read
- `deleteNotification(notificationId)` - Delete a single notification
- `deleteAllNotifications()` - Delete all notifications

**Internal Helper:**
- `createNotification()` - Internal function to create notifications (not exposed as API endpoint)

#### Routes: routes/notifications.js
```
GET    /api/notifications                    - Get all notifications
GET    /api/notifications/unread-count       - Get unread count
PUT    /api/notifications/:notificationId/read - Mark as read
PUT    /api/notifications/mark-all/read      - Mark all as read
DELETE /api/notifications/:notificationId    - Delete notification
DELETE /api/notifications                    - Delete all notifications
```

#### Notification Triggers

**1. Welcome Notification (authController.js - register function)**
- Triggered after successful user registration
- Message: "Welcome to Run4Fun!"
- Sends welcome details and feature overview

**2. Event Created Notification (eventController.js - publishEvent function)**
- Triggered when an organizer publishes an event
- Sent to all users with role 'participant'
- Message: "New event published: {event_name}"
- Non-blocking operation to avoid delaying event publication

**3. Registration Confirmed Notification (paymentController.js - processPayment function)**
- Triggered after successful payment processing
- Sent to the participant who registered
- Message: "Your place on {event_name} is confirmed!"

**4. Participant Joined Notification (paymentController.js - processPayment function)**
- Triggered after successful payment processing
- Sent to the event organizer
- Message: "{participant_name} joined {event_name}"

### Frontend

#### Notifications Page (pages/Notifications.js)
A comprehensive notifications management interface with:

**Features:**
- Display all notifications in a list view
- Filter between "All" and "Unread" notifications
- Click on a notification to view full details in a sidebar
- Mark individual notifications as read
- Mark all notifications as read
- Delete individual notifications
- Delete all notifications
- Visual indicators for notification types (emojis)
- Color-coded notification categories
- Responsive layout (single column on mobile, multi-column on desktop)

**Notification Display:**
- Notification type icon (emoji)
- Title and brief message
- Full message in detail panel
- Creation date and time
- Unread indicator (blue dot)
- Action buttons (Mark as Read, Delete)

#### Navigation Component Updates
- Added Notifications link in navigation bar
- Badge showing unread notification count
- Refreshes unread count every 30 seconds
- Badge shows "9+" if more than 9 unread notifications

#### Routes
- `/notifications` - Protected route to view all notifications

## API Usage Examples

### Fetch all notifications
```javascript
GET /api/notifications
Headers: Authorization: Bearer {token}

Response:
{
  success: true,
  count: 5,
  data: [
    {
      _id: "...",
      user_id: "...",
      type: "welcome",
      title: "Welcome to Run4Fun!",
      message: "Welcome to Run4Fun! Explore the amazing features...",
      fullMessage: "Welcome to Run4Fun!...",
      isRead: true,
      createdAt: "2024-01-15T10:30:00Z"
    },
    ...
  ]
}
```

### Get unread count
```javascript
GET /api/notifications/unread-count
Headers: Authorization: Bearer {token}

Response:
{
  success: true,
  unreadCount: 3
}
```

### Mark notification as read
```javascript
PUT /api/notifications/{notificationId}/read
Headers: Authorization: Bearer {token}

Response:
{
  success: true,
  message: "Notification marked as read",
  data: { ... }
}
```

### Delete notification
```javascript
DELETE /api/notifications/{notificationId}
Headers: Authorization: Bearer {token}

Response:
{
  success: true,
  message: "Notification deleted successfully"
}
```

## Testing the Notification Flow

### Test Scenario 1: Welcome Notification
1. Register a new user at `/register`
2. Check notifications page at `/notifications`
3. Should see one "Welcome to Run4Fun!" notification

### Test Scenario 2: New Event Published Notification
1. Login as organizer
2. Create and publish a new event at `/manage-events`
3. Login as different participant user
4. Check notifications page
5. Should see "New event published" notification for the new event

### Test Scenario 3: Registration Confirmation
1. Login as participant
2. Go to event details and click "Register"
3. Complete registration with event details
4. Process payment (auto-succeeds in mock mode)
5. Check notifications page
6. Should see "Registration Confirmed" notification

### Test Scenario 4: Participant Joined Notification
1. Setup scenario 3 with participant registration
2. Login as the event organizer
3. Check notifications page
4. Should see "Participant Joined" notification

## Error Handling
- If notification creation fails during any operation, the main operation (registration, event publication, etc.) continues without blocking
- Errors are logged to console for debugging
- Users won't see notification-related errors as they're handled gracefully

## Future Enhancements
- Real-time notifications using WebSockets
- Email notifications
- Push notifications
- Notification preferences/settings
- Notification categories and filtering options
- Archive notifications functionality
- Notification templates system
