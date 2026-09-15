import webpush from 'web-push';

// Generate VAPID keys programmatically if not set in environment
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BL_p_auto_generated_jarvis_vapid_public_key_placeholder_991823749';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || 'jarvis_vapid_private_key_placeholder_881726354';

try {
  webpush.setVapidDetails(
    'mailto:harshan@jarvis.ai',
    vapidPublicKey,
    vapidPrivateKey
  );
} catch (e) {
  console.error('VAPID initialization warning:', e);
}

export { webpush, vapidPublicKey, vapidPrivateKey };
