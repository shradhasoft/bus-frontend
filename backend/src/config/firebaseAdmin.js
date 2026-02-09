import admin from "firebase-admin";

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!serviceAccountJson) {
  throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON env");
}

let credential;

try {
  const serviceAccount = JSON.parse(serviceAccountJson);
  credential = admin.credential.cert(serviceAccount);
} catch (error) {
  throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT_JSON: ${error.message}`);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential,
  });
}

export const firebaseAdmin = admin;
