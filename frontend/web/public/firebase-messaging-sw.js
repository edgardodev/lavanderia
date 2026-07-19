/* Service Worker para Firebase Cloud Messaging.
   En producción, reemplaza los valores por tus variables públicas de Firebase durante el build. */
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification?.title || 'La Lavandería & Bakery', {
    body: payload.notification?.body || 'Tienes una actualización de tu servicio.',
    icon: '/logo.png',
  });
});
