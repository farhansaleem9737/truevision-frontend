// truevision/services/firebase.js
//
// Firebase initialisation. We use Firestore for the comment system —
// add / edit / delete + real-time onSnapshot updates.
//
// ── SETUP ────────────────────────────────────────────────────────────────────
// 1. Create a Firebase project at https://console.firebase.google.com
// 2. Add a Web app (yes, even for React Native — the JS SDK runs fine in Expo)
// 3. Copy the config object below
// 4. Enable Firestore (Build → Firestore Database → Create database)
// 5. Paste these security rules so only the owner can edit/delete:
//
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /comments/{commentId} {
//          allow read: if true;
//          allow create: if request.resource.data.userId is string;
//          allow update, delete: if resource.data.userId == request.auth.uid
//                                || resource.data.userId == request.resource.data.userId;
//        }
//      }
//    }
//
//    Note: this app uses JWT auth, not Firebase Auth, so request.auth.uid will
//    be null. The fallback compares the stored userId — fine for a dev setup,
//    but for production you should mint a Firebase custom token on your backend
//    and call signInWithCustomToken() so the rules can trust request.auth.uid.

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// ── PASTE YOUR FIREBASE CONFIG HERE ──────────────────────────────────────────
const firebaseConfig = {
  apiKey:            'YOUR_API_KEY',
  authDomain:        'YOUR_PROJECT.firebaseapp.com',
  projectId:         'YOUR_PROJECT_ID',
  storageBucket:     'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId:             'YOUR_APP_ID',
};

const isConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== 'YOUR_API_KEY';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db  = getFirestore(app);

if (!isConfigured && __DEV__) {
  console.warn(
    '[firebase] Config not set — fill in services/firebase.js with your project credentials. ' +
    'Comment edit/delete will not work until then.'
  );
}

export { app, db, isConfigured };
