import { useEffect } from 'react';

export function usePushSubscription() {
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(async (registration) => {
        try {
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
          });
          
          await fetch('/api/push/subscribe', {
            method: 'POST',
            body: JSON.stringify(subscription),
            headers: { 'Content-Type': 'application/json' },
          });
          console.log('Push subscription registered successfully.');
        } catch (err) {
          console.error('Failed to subscribe to push:', err);
        }
      });
    }
  }, []);
}
