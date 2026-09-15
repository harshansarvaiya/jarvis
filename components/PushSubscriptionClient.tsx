'use client';

import { usePushSubscription } from '@/lib/hooks/usePushSubscription';

export function PushSubscriptionClient() {
  usePushSubscription();
  return null;
}
