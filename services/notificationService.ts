// services/notificationService.ts

/**
 * A service to manage browser notifications for background tasks.
 */

/**
 * Requests permission from the user to show notifications.
 * @returns {Promise<NotificationPermission>} The permission granted by the user.
 */
export const requestPermission = (): Promise<NotificationPermission> => {
  return Notification.requestPermission();
};

/**
 * Displays a notification to the user if permission is granted and the tab is not active.
 * @param {string} title - The title of the notification.
 * @param {NotificationOptions} [options] - Standard HTML Notification API options.
 */
export const notify = (title: string, options?: NotificationOptions): void => {
  // 1. Check if notifications are supported by the browser
  if (!('Notification' in window)) {
    console.log('This browser does not support desktop notification');
    return;
  }

  // 2. Check if permission has been granted
  if (Notification.permission === 'granted') {
    // 3. Check if the document is hidden (i.e., user is on another tab or window)
    if (document.hidden) {
      const notification = new Notification(title, {
        ...options,
        icon: '/favicon.ico', // Optional: Add an icon
      });

      // Optional: bring the user to the window when they click the notification
      notification.onclick = () => {
        window.focus();
      };
    }
  } else if (Notification.permission === 'denied') {
    // Permission has been explicitly denied. Do nothing.
    console.warn('Notification permission has been denied by the user.');
  }
  // If permission is 'default', we don't show a notification.
  // The user should explicitly grant permission via the UI (e.g., in Settings).
};
