import React, { useEffect, useState } from 'react';
import axios from 'axios';

const NotificationSection = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true); // Loading state
  const [error, setError] = useState(null); // Error state

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true); // Start loading
        const response = await axios.get('/api/notifications');
        setNotifications(response.data);
      } catch (error) {
        console.error('Error fetching notifications:', error);
        setError('Failed to load notifications.'); // Set error message
      } finally {
        setLoading(false); // End loading
      }
    };

    fetchNotifications();
  }, []);

  return (
    <div>
      <h3>Notifications</h3>
      {loading ? (
        <p>Loading notifications...</p> // Loading message
      ) : error ? (
        <p>{error}</p> // Error message
      ) : notifications.length === 0 ? (
        <p>No notifications available.</p> // Empty state message
      ) : (
        <ul>
          {notifications.map(notification => (
            <li key={notification._id}>{notification.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default NotificationSection;
