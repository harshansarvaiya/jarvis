import { useEffect } from 'react';

/**
 * Converts a base64 URL-safe string to a Uint8Array required by PushManager
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushSubscription() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      console.warn('[J.A.R.V.I.S. Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set; skipping auto-subscription.');
      return;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      console.log('[J.A.R.V.I.S. Push] Push API not supported on this client.');
      return;
    }

    // Only attempt pushManager subscription if permission has been granted by user
    if (Notification.permission !== 'granted') {
      return;
    }

    navigator.serviceWorker.ready.then(async (registration) => {
      try {
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          const applicationServerKey = urlBase64ToUint8Array(vapidKey);
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey as unknown as BufferSource,
          });
        }

        if (subscription) {
          await fetch('/api/push/subscribe', {
            method: 'POST',
            body: JSON.stringify(subscription),
            headers: { 'Content-Type': 'application/json' },
          });
          console.log('[J.A.R.V.I.S. Push] Device subscription synced with Upstash Redis.');
        }
      } catch (err) {
        console.warn('[J.A.R.V.I.S. Push] Subscription registration note:', err);
      }
    });
  }, []);
}
