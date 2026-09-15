'use client';
import { usePushSubscription } from '@/lib/hooks/usePushSubscription';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  usePushSubscription();
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
