/**
 * Divvy Push Notification Cloud Functions
 *
 * Endpoints:
 *   POST /subscribe   - Register an FCM token for a notification group
 *   POST /unsubscribe - Remove an FCM token from a notification group
 *   POST /notify      - Send push notifications to all group members (except sender)
 *
 * Firestore schema:
 *   notificationGroups/{groupId}/tokens/{tokenDoc}
 *     - token: string (FCM registration token)
 *     - userName: string
 *     - subscribedAt: timestamp
 *
 * Setup:
 *   1. firebase login
 *   2. firebase init functions (select existing project)
 *   3. cd functions && npm install
 *   4. firebase deploy --only functions
 */

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * CORS headers for browser requests
 */
function setCorsHeaders(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

/**
 * POST /subscribe
 * Body: { groupId: string, token: string, userName: string }
 *
 * Registers an FCM token under a notification group in Firestore.
 */
exports.subscribe = onRequest(async (req, res) => {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { groupId, token, userName } = req.body;
  if (!groupId || !token) {
    return res.status(400).json({ error: "groupId and token are required" });
  }

  try {
    // Use a hash of the token as the document ID to avoid duplicates
    const tokenHash = Buffer.from(token).toString("base64url").slice(0, 40);
    await db.collection("notificationGroups").doc(groupId)
      .collection("tokens").doc(tokenHash).set({
        token,
        userName: userName || "Someone",
        subscribedAt: admin.firestore.FieldValue.serverTimestamp()
      });

    res.json({ success: true, message: "Subscribed to notifications" });
  } catch (error) {
    console.error("Subscribe error:", error);
    res.status(500).json({ error: "Failed to subscribe" });
  }
});

/**
 * POST /unsubscribe
 * Body: { groupId: string, token: string }
 *
 * Removes an FCM token from a notification group.
 */
exports.unsubscribe = onRequest(async (req, res) => {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { groupId, token } = req.body;
  if (!groupId || !token) {
    return res.status(400).json({ error: "groupId and token are required" });
  }

  try {
    const tokenHash = Buffer.from(token).toString("base64url").slice(0, 40);
    await db.collection("notificationGroups").doc(groupId)
      .collection("tokens").doc(tokenHash).delete();

    res.json({ success: true, message: "Unsubscribed from notifications" });
  } catch (error) {
    console.error("Unsubscribe error:", error);
    res.status(500).json({ error: "Failed to unsubscribe" });
  }
});

/**
 * POST /notify
 * Body: { groupId: string, senderToken: string, title: string, body: string }
 *
 * Sends a push notification to all group members except the sender.
 */
exports.notify = onRequest(async (req, res) => {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { groupId, senderToken, title, body } = req.body;
  if (!groupId || !title) {
    return res.status(400).json({ error: "groupId and title are required" });
  }

  try {
    // Fetch all tokens in the group
    const snapshot = await db.collection("notificationGroups").doc(groupId)
      .collection("tokens").get();

    if (snapshot.empty) {
      return res.json({ success: true, sent: 0, message: "No subscribers in group" });
    }

    // Collect tokens, excluding the sender
    const tokens = [];
    const staleTokenDocs = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.token && data.token !== senderToken) {
        tokens.push(data.token);
      }
    });

    if (tokens.length === 0) {
      return res.json({ success: true, sent: 0, message: "No other subscribers to notify" });
    }

    // Send notification via FCM
    const message = {
      notification: {
        title: title || "Divvy",
        body: body || "New activity in your group"
      },
      data: {
        tag: "divvy-expense",
        url: "./"
      },
      webpush: {
        headers: {
          Urgency: "high"
        },
        notification: {
          icon: "/icons/icon-192x192.png",
          badge: "/icons/icon-96x96.png",
          renotify: "true",
          tag: "divvy-expense"
        }
      }
    };

    // Send to each token individually (sendEachForMulticast handles batching)
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      ...message
    });

    // Clean up stale tokens (tokens that failed permanently)
    const failedTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const errorCode = resp.error?.code;
        // Remove tokens that are permanently invalid
        if (errorCode === "messaging/invalid-registration-token" ||
            errorCode === "messaging/registration-token-not-registered") {
          failedTokens.push(tokens[idx]);
        }
      }
    });

    // Remove stale tokens from Firestore
    if (failedTokens.length > 0) {
      const batch = db.batch();
      for (const staleToken of failedTokens) {
        const tokenHash = Buffer.from(staleToken).toString("base64url").slice(0, 40);
        const docRef = db.collection("notificationGroups").doc(groupId)
          .collection("tokens").doc(tokenHash);
        batch.delete(docRef);
      }
      await batch.commit();
      console.log(`Cleaned up ${failedTokens.length} stale token(s)`);
    }

    res.json({
      success: true,
      sent: response.successCount,
      failed: response.failureCount,
      cleaned: failedTokens.length
    });
  } catch (error) {
    console.error("Notify error:", error);
    res.status(500).json({ error: "Failed to send notifications" });
  }
});
