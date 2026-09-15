import { getApp, getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { apiFetch } from './api';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let registrationPromise: Promise<void> | null = null;
let foregroundListenerRegistered = false;

function hasFirebaseConfig() {
  return Boolean(
    firebaseConfig.apiKey
    && firebaseConfig.projectId
    && firebaseConfig.messagingSenderId
    && firebaseConfig.appId
    && process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
  );
}

async function performRegistration() {
  if (typeof window === 'undefined' || !hasFirebaseConfig()) return;
  if (!(await isSupported())) return;

  let permission = Notification.permission;
  if (permission === 'default') permission = await Notification.requestPermission();
  if (permission !== 'granted') return;

  const serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration,
  });
  if (token) {
    await apiFetch('/notifications/token', {
      method: 'POST',
      body: JSON.stringify({ token, deviceType: 'web' }),
    });
  }

  if (!foregroundListenerRegistered) {
    foregroundListenerRegistered = true;
    onMessage(messaging, (payload) => {
      if (payload.notification?.title && Notification.permission === 'granted') {
        new Notification(payload.notification.title, {
          body: payload.notification.body,
          icon: '/logo.png',
        });
      }
    });
  }
}

export async function registerPushNotifications() {
  if (!registrationPromise) {
    registrationPromise = performRegistration().catch((error) => {
      registrationPromise = null;
      throw error;
    });
  }
  return registrationPromise;
}
