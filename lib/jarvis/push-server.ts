import webpush from 'web-push';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(
      'mailto:harshan@jarvis.ai',
      vapidPublicKey,
      vapidPrivateKey
    );
  } catch (e) {
    console.error('[J.A.R.V.I.S. Push Server] VAPID initialization warning:', e);
  }
}

export { webpush, vapidPublicKey, vapidPrivateKey };
