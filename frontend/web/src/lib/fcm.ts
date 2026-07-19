import { initializeApp } from 'firebase/app';
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

export async function registerPushNotifications() {
  if (!(await isSupported())) return;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;

  const app = initializeApp(firebaseConfig);
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY });
  if (token) await apiFetch('/notifications/token', { method: 'POST', body: JSON.stringify({ token, deviceType: 'web' }) });

  onMessage(messaging, (payload) => {
    if (payload.notification?.title) {
      new Notification(payload.notification.title, { body: payload.notification.body });
    }
  });
}
