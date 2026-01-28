/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

describe('Push Notification Configuration', () => {
  let htmlContent;
  let swContent;
  let manifestContent;

  beforeAll(() => {
    htmlContent = fs.readFileSync(path.join(process.cwd(), 'divvy.html'), 'utf8');
    swContent = fs.readFileSync(path.join(process.cwd(), 'sw.js'), 'utf8');
    manifestContent = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'manifest.json'), 'utf8'));
  });

  describe('Service Worker - Push Handling', () => {
    test('has push event listener', () => {
      expect(swContent).toContain("addEventListener('push'");
    });

    test('has notificationclick event listener', () => {
      expect(swContent).toContain("addEventListener('notificationclick'");
    });

    test('shows notification with title and body from push data', () => {
      expect(swContent).toContain('self.registration.showNotification');
    });

    test('handles missing push data gracefully', () => {
      expect(swContent).toContain('if (!event.data)');
    });

    test('supports both notification and data payloads', () => {
      expect(swContent).toContain('payload.notification');
      expect(swContent).toContain('payload.data');
    });

    test('focuses existing window on notification click', () => {
      expect(swContent).toContain('clients.matchAll');
      expect(swContent).toContain('client.focus()');
    });

    test('opens new window if no existing window found', () => {
      expect(swContent).toContain('clients.openWindow');
    });

    test('caches Firebase SDK resources', () => {
      expect(swContent).toContain("url.hostname.includes('www.gstatic.com')");
    });
  });

  describe('Manifest - FCM Support', () => {
    test('has gcm_sender_id for Firebase Cloud Messaging', () => {
      expect(manifestContent.gcm_sender_id).toBe('103953800507');
    });
  });

  describe('Client App - Firebase Integration', () => {
    test('includes Firebase App SDK script', () => {
      expect(htmlContent).toMatch(/firebase-app-compat\.js/);
    });

    test('includes Firebase Messaging SDK script', () => {
      expect(htmlContent).toMatch(/firebase-messaging-compat\.js/);
    });

    test('stores service worker registration on window', () => {
      expect(htmlContent).toContain('window.__swRegistration');
    });

    test('has notification state management', () => {
      expect(htmlContent).toContain('notificationsEnabled');
      expect(htmlContent).toContain('showNotificationSettings');
      expect(htmlContent).toContain('notificationGroupId');
    });

    test('has enableNotifications function', () => {
      expect(htmlContent).toContain('const enableNotifications');
    });

    test('has disableNotifications function', () => {
      expect(htmlContent).toContain('const disableNotifications');
    });

    test('has sendExpenseNotification function', () => {
      expect(htmlContent).toContain('const sendExpenseNotification');
    });

    test('has saveNotificationSettings function', () => {
      expect(htmlContent).toContain('const saveNotificationSettings');
    });

    test('calls sendExpenseNotification in submitExpense', () => {
      expect(htmlContent).toContain('sendExpenseNotification(newExpense)');
    });

    test('has notification settings modal', () => {
      expect(htmlContent).toContain('Push Notifications');
      expect(htmlContent).toContain('Firebase Config (JSON)');
      expect(htmlContent).toContain('VAPID Key');
      expect(htmlContent).toContain('Cloud Function URL');
      expect(htmlContent).toContain('Notification Group ID');
    });

    test('has notification bell button in header', () => {
      expect(htmlContent).toContain('notifications_active');
      expect(htmlContent).toContain('notifications_none');
    });

    test('reads notification config from localStorage', () => {
      expect(htmlContent).toContain('divvy_firebase_config');
      expect(htmlContent).toContain('divvy_vapid_key');
      expect(htmlContent).toContain('divvy_notify_url');
      expect(htmlContent).toContain('divvy_notification_group');
    });

    test('auto-initializes notifications if previously enabled', () => {
      expect(htmlContent).toContain('divvy_notifications_enabled');
    });
  });

  describe('Cloud Function', () => {
    let functionCode;

    beforeAll(() => {
      functionCode = fs.readFileSync(path.join(process.cwd(), 'functions', 'index.js'), 'utf8');
    });

    test('functions/index.js exists', () => {
      expect(fs.existsSync(path.join(process.cwd(), 'functions', 'index.js'))).toBe(true);
    });

    test('has subscribe endpoint', () => {
      expect(functionCode).toContain('exports.subscribe');
    });

    test('has unsubscribe endpoint', () => {
      expect(functionCode).toContain('exports.unsubscribe');
    });

    test('has notify endpoint', () => {
      expect(functionCode).toContain('exports.notify');
    });

    test('uses Firebase Admin SDK', () => {
      expect(functionCode).toContain('firebase-admin');
      expect(functionCode).toContain('admin.initializeApp');
    });

    test('uses Firestore for token storage', () => {
      expect(functionCode).toContain('admin.firestore()');
      expect(functionCode).toContain('notificationGroups');
    });

    test('sends FCM via sendEachForMulticast', () => {
      expect(functionCode).toContain('sendEachForMulticast');
    });

    test('excludes sender from notifications', () => {
      expect(functionCode).toContain('data.token !== senderToken');
    });

    test('cleans up stale tokens', () => {
      expect(functionCode).toContain('registration-token-not-registered');
      expect(functionCode).toContain('invalid-registration-token');
    });

    test('sets CORS headers', () => {
      expect(functionCode).toContain('Access-Control-Allow-Origin');
    });

    test('has package.json with required dependencies', () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'functions', 'package.json'), 'utf8'));
      expect(pkg.dependencies).toHaveProperty('firebase-admin');
      expect(pkg.dependencies).toHaveProperty('firebase-functions');
    });
  });
});
