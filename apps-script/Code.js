/**
 * Divvy Push Notification Bridge — Google Apps Script
 *
 * Deployed as a web app, this script bridges the Divvy PWA with Firebase
 * Cloud Messaging. It provides identity verification, permission checking,
 * rate limiting, and FCM topic management — all for free.
 *
 * Setup:
 *   1. npm install -g @google/clasp && clasp login
 *   2. clasp create --title "DivvyNotifyBridge" --type webapp
 *   3. Add Script Properties (Project Settings > Script Properties):
 *        FIREBASE_PROJECT_ID = your-firebase-project-id
 *   4. Add OAuth scopes: see appsscript.json
 *   5. clasp push && clasp deploy --description "v1"
 *   6. Deploy as: Execute as "Me", Access "Anyone"
 *   7. Copy the web app URL into APPS_SCRIPT_URL in divvy.html
 *
 * Endpoints (all via POST to the deployed web app URL):
 *   { action: "subscribe",   accessToken, sheetId, fcmToken }
 *   { action: "unsubscribe", accessToken, sheetId, fcmToken }
 *   { action: "notify",      accessToken, sheetId, message: { title, body } }
 *
 * Security model:
 *   - Caller identity verified via Google OAuth tokeninfo
 *   - Sheet access verified using caller's own access token
 *   - Rate limited: 1 notify per user per sheet every 30 seconds
 *   - FCM operations use the script owner's OAuth token (firebase.messaging scope)
 */

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ error: "Invalid JSON body" });
  }

  var action = data.action;
  if (!action || !data.accessToken || !data.sheetId) {
    return jsonResponse({ error: "Missing required fields: action, accessToken, sheetId" });
  }

  // 1. VERIFY IDENTITY — confirm the access token is valid and get email
  var userEmail = verifyAccessToken(data.accessToken);
  if (!userEmail) {
    return jsonResponse({ error: "Invalid or expired access token" });
  }

  // 2. VERIFY SHEET ACCESS — caller must be an owner/editor of the sheet
  if (!verifySheetAccess(data.accessToken, data.sheetId)) {
    return jsonResponse({ error: "No access to this sheet" });
  }

  // 3. RATE LIMIT (notify only) — 30-second cooldown per user per sheet
  if (action === "notify") {
    var cache = CacheService.getScriptCache();
    var rateLimitKey = "rate_" + userEmail + "_" + data.sheetId;
    if (cache.get(rateLimitKey)) {
      return jsonResponse({ error: "Rate limited. Wait 30 seconds." });
    }
    cache.put(rateLimitKey, "1", 30);
  }

  // 4. DISPATCH ACTION
  switch (action) {
    case "subscribe":
      if (!data.fcmToken) return jsonResponse({ error: "Missing fcmToken" });
      return subscribeToTopic(data.sheetId, data.fcmToken);

    case "unsubscribe":
      if (!data.fcmToken) return jsonResponse({ error: "Missing fcmToken" });
      return unsubscribeFromTopic(data.sheetId, data.fcmToken);

    case "notify":
      if (!data.message) return jsonResponse({ error: "Missing message" });
      return sendNotification(data.sheetId, userEmail, data.message);

    default:
      return jsonResponse({ error: "Unknown action: " + action });
  }
}

// ---------------------------------------------------------------------------
// Identity & permission verification
// ---------------------------------------------------------------------------

function verifyAccessToken(accessToken) {
  try {
    var resp = UrlFetchApp.fetch(
      "https://oauth2.googleapis.com/tokeninfo?access_token=" + accessToken,
      { muteHttpExceptions: true }
    );
    if (resp.getResponseCode() !== 200) return null;
    var info = JSON.parse(resp.getContentText());
    return info.email || null;
  } catch (err) {
    return null;
  }
}

function verifySheetAccess(accessToken, sheetId) {
  try {
    var resp = UrlFetchApp.fetch(
      "https://sheets.googleapis.com/v4/spreadsheets/" + sheetId + "?fields=spreadsheetId",
      {
        headers: { "Authorization": "Bearer " + accessToken },
        muteHttpExceptions: true
      }
    );
    return resp.getResponseCode() === 200;
  } catch (err) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// FCM Topic Management (via Instance ID API)
// ---------------------------------------------------------------------------

function subscribeToTopic(topicName, fcmToken) {
  var token = ScriptApp.getOAuthToken();
  try {
    var resp = UrlFetchApp.fetch("https://iid.googleapis.com/iid/v1:batchAdd", {
      method: "post",
      contentType: "application/json",
      headers: { "Authorization": "Bearer " + token, "access_token_auth": "true" },
      payload: JSON.stringify({
        to: "/topics/" + sanitizeTopic(topicName),
        registration_tokens: [fcmToken]
      }),
      muteHttpExceptions: true
    });
    var result = JSON.parse(resp.getContentText());
    return jsonResponse({ success: true, result: result });
  } catch (err) {
    return jsonResponse({ error: "Subscribe failed: " + err.message });
  }
}

function unsubscribeFromTopic(topicName, fcmToken) {
  var token = ScriptApp.getOAuthToken();
  try {
    var resp = UrlFetchApp.fetch("https://iid.googleapis.com/iid/v1:batchRemove", {
      method: "post",
      contentType: "application/json",
      headers: { "Authorization": "Bearer " + token, "access_token_auth": "true" },
      payload: JSON.stringify({
        to: "/topics/" + sanitizeTopic(topicName),
        registration_tokens: [fcmToken]
      }),
      muteHttpExceptions: true
    });
    var result = JSON.parse(resp.getContentText());
    return jsonResponse({ success: true, result: result });
  } catch (err) {
    return jsonResponse({ error: "Unsubscribe failed: " + err.message });
  }
}

// ---------------------------------------------------------------------------
// FCM Notification (via HTTP v1 API)
// ---------------------------------------------------------------------------

function sendNotification(topicName, senderEmail, message) {
  var projectId = PropertiesService.getScriptProperties().getProperty("FIREBASE_PROJECT_ID");
  if (!projectId) {
    return jsonResponse({ error: "FIREBASE_PROJECT_ID not configured in Script Properties" });
  }

  var token = ScriptApp.getOAuthToken();
  var url = "https://fcm.googleapis.com/v1/projects/" + projectId + "/messages:send";

  var payload = {
    message: {
      topic: sanitizeTopic(topicName),
      data: {
        sender: senderEmail,
        title: message.title || "Divvy",
        body: message.body || "New activity in your group",
        tag: "divvy-expense",
        url: "./"
      },
      webpush: {
        headers: { "Urgency": "high" }
      }
    }
  };

  try {
    var resp = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: { "Authorization": "Bearer " + token },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    if (resp.getResponseCode() === 200) {
      return jsonResponse({ success: true });
    } else {
      return jsonResponse({ error: "FCM send failed", details: resp.getContentText() });
    }
  } catch (err) {
    return jsonResponse({ error: "FCM send error: " + err.message });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** FCM topic names must match [a-zA-Z0-9-_.~%]+ */
function sanitizeTopic(name) {
  return name.replace(/[^a-zA-Z0-9\-_.~%]/g, "_");
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
