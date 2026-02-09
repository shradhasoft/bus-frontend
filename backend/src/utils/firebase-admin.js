// src/utils/firebase-admin.js
import { firebaseAdmin } from "../config/firebaseAdmin.js";

// ✅ This is what your authMiddleware imports as firebaseAdminAuth
export const auth = firebaseAdmin.auth();

// optional default export if you ever need admin.firestore(), etc.
export default firebaseAdmin;
