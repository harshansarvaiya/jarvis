/**
 * J.A.R.V.I.S. Push Notification Substrate
 * Enables tactical push notifications, scheduled reminders, and audio alerts across devices.
 */

export interface JarvisNotification {
  id: string;
  title: string;
  message: string;
  priority?: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
  category?: 'REMINDER' | 'SECURITY' | 'TASK' | 'DEPLOYMENT' | 'GENERAL';
  timestamp: string;
  delaySeconds?: number;
  triggerAt?: string;
  status?: 'SENT' | 'PENDING' | 'ACKNOWLEDGED';
  actionUrl?: string;
}

/**
 * Plays a synthesized futuristic dual-tone acoustic chime via Web Audio API
 */
export function playJarvisNotificationChime(frequency = 880, duration = 0.35): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(frequency * 1.5, ctx.currentTime + duration * 0.4);
    osc.frequency.setValueAtTime(frequency * 2, ctx.currentTime + duration * 0.5);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    console.warn('[Notification Sound] AudioContext playback warning:', e);
  }
}

/**
 * Dispatches an immediate or scheduled notification to the user
 */
export async function triggerDeviceNotification(
  notification: JarvisNotification
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const { title, message, priority = 'NORMAL', delaySeconds = 0, actionUrl = '/' } = notification;

  // Check Notification permission
  if (!('Notification' in window)) {
    console.warn('[Notification] Browser does not support Web Notifications.');
    return false;
  }

  const fire = async () => {
    playJarvisNotificationChime(priority === 'CRITICAL' ? 1200 : 880);

    const options: NotificationOptions = {
      body: message,
      icon: '/icon.png',
      badge: '/icon.png',
      tag: `jarvis-notif-${notification.id}`,
      requireInteraction: priority === 'CRITICAL' || priority === 'HIGH',
      data: {
        url: actionUrl,
        timestamp: Date.now(),
        notificationId: notification.id,
      },
    };

    // Try service worker notification first (supports background/PWA notifications)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(title, options);
          return true;
        }
      } catch (swErr) {
        console.warn('[Notification] SW showNotification fallback:', swErr);
      }
    }

    // Fallback to standard Window Notification constructor
    try {
      const notif = new Notification(title, options);
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
      return true;
    } catch (winErr) {
      console.warn('[Notification] Standard Notification fallback error:', winErr);
      return false;
    }
  };

  if (Notification.permission === 'granted') {
    if (delaySeconds && delaySeconds > 0) {
      setTimeout(fire, delaySeconds * 1000);
      return true;
    }
    return await fire();
  }

  // If permission not yet granted, request it
  if (Notification.permission === 'default') {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      if (delaySeconds && delaySeconds > 0) {
        setTimeout(fire, delaySeconds * 1000);
        return true;
      }
      return await fire();
    }
  }

  return false;
}
