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

    test('has mute-myself logic via Cache API', () => {
      expect(swContent).toContain('getCurrentUserEmail');
      expect(swContent).toContain("caches.open('divvy-user')");
      expect(swContent).toContain('Muting own notification');
    });

    test('compares sender email to current user for muting', () => {
      expect(swContent).toContain('myEmail === senderEmail');
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

    test('has hardcoded Firebase and Apps Script config constants', () => {
      expect(htmlContent).toContain('const FIREBASE_CONFIG');
      expect(htmlContent).toContain('const FIREBASE_VAPID_KEY');
      expect(htmlContent).toContain('const APPS_SCRIPT_URL');
    });

    test('has isNotificationsConfigured check', () => {
      expect(htmlContent).toContain('const isNotificationsConfigured');
    });

    test('bell icon only shows when configured and sheet connected', () => {
      expect(htmlContent).toContain('isNotificationsConfigured() && sheetId');
    });

    test('has notification state management', () => {
      expect(htmlContent).toContain('notificationsEnabled');
      expect(htmlContent).toContain('showNotificationPanel');
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

    test('calls sendExpenseNotification in submitExpense', () => {
      expect(htmlContent).toContain('sendExpenseNotification(newExpense)');
    });

    test('has notification panel with enable/disable controls', () => {
      expect(htmlContent).toContain('Push Notifications');
      expect(htmlContent).toContain('Enable Notifications');
      expect(htmlContent).toContain('Turn Off Notifications');
    });

    test('has notification bell button in header', () => {
      expect(htmlContent).toContain('notifications_active');
      expect(htmlContent).toContain('notifications_none');
    });

    test('persists notification enabled state', () => {
      expect(htmlContent).toContain('divvy_notifications_enabled');
    });

    test('auto-initializes notifications if previously enabled', () => {
      expect(htmlContent).toContain('if (notificationsEnabled && isNotificationsConfigured()');
    });

    test('has callAppsScript helper for API calls', () => {
      expect(htmlContent).toContain('const callAppsScript');
      expect(htmlContent).toContain('APPS_SCRIPT_URL');
    });

    test('calls Apps Script with subscribe, unsubscribe, and notify actions', () => {
      expect(htmlContent).toContain("callAppsScript('subscribe'");
      expect(htmlContent).toContain("callAppsScript('unsubscribe'");
      expect(htmlContent).toContain("callAppsScript('notify'");
    });

    test('stores user email in Cache API for service worker mute-myself', () => {
      expect(htmlContent).toContain('const storeEmailForServiceWorker');
      expect(htmlContent).toContain("caches.open('divvy-user')");
    });
  });

  describe('Apps Script Backend', () => {
    let scriptCode;

    beforeAll(() => {
      scriptCode = fs.readFileSync(path.join(process.cwd(), 'apps-script', 'Code.js'), 'utf8');
    });

    test('apps-script/Code.js exists', () => {
      expect(fs.existsSync(path.join(process.cwd(), 'apps-script', 'Code.js'))).toBe(true);
    });

    test('has doPost entry point', () => {
      expect(scriptCode).toContain('function doPost(e)');
    });

    test('verifies caller identity via Google tokeninfo', () => {
      expect(scriptCode).toContain('verifyAccessToken');
      expect(scriptCode).toContain('oauth2.googleapis.com/tokeninfo');
    });

    test('verifies sheet access with caller token', () => {
      expect(scriptCode).toContain('verifySheetAccess');
      expect(scriptCode).toContain('sheets.googleapis.com/v4/spreadsheets');
    });

    test('has rate limiting via CacheService', () => {
      expect(scriptCode).toContain('CacheService.getScriptCache()');
      expect(scriptCode).toContain('rate_');
    });

    test('subscribes to FCM topic via IID API', () => {
      expect(scriptCode).toContain('iid.googleapis.com/iid/v1:batchAdd');
      expect(scriptCode).toContain('subscribeToTopic');
    });

    test('unsubscribes from FCM topic via IID API', () => {
      expect(scriptCode).toContain('iid.googleapis.com/iid/v1:batchRemove');
      expect(scriptCode).toContain('unsubscribeFromTopic');
    });

    test('sends notifications via FCM v1 API', () => {
      expect(scriptCode).toContain('fcm.googleapis.com/v1/projects');
      expect(scriptCode).toContain('messages:send');
    });

    test('includes sender email in notification data for mute-myself', () => {
      expect(scriptCode).toContain('sender: senderEmail');
    });

    test('sanitizes topic names for FCM', () => {
      expect(scriptCode).toContain('sanitizeTopic');
    });

    test('uses ScriptApp OAuth token for FCM operations', () => {
      expect(scriptCode).toContain('ScriptApp.getOAuthToken()');
    });

    test('dispatches subscribe, unsubscribe, and notify actions', () => {
      expect(scriptCode).toContain('case "subscribe"');
      expect(scriptCode).toContain('case "unsubscribe"');
      expect(scriptCode).toContain('case "notify"');
    });

    test('has appsscript.json manifest with required OAuth scopes', () => {
      const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'apps-script', 'appsscript.json'), 'utf8'));
      expect(manifest.oauthScopes).toContain('https://www.googleapis.com/auth/firebase.messaging');
      expect(manifest.oauthScopes).toContain('https://www.googleapis.com/auth/script.external_request');
      expect(manifest.webapp.access).toBe('ANYONE');
    });
  });
});
