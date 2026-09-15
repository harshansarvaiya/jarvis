import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PushSubscriptionClient } from '@/components/PushSubscriptionClient';

export const metadata: Metadata = {
  title: 'J.A.R.V.I.S. — Autonomous Cognitive Exoskeleton',
  description: 'Tactical executive copilot, long-term memory graph, and sovereign agent system.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#05070d',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-jarvis-bg text-slate-100 antialiased selection:bg-cyan-500 selection:text-black">
        <PushSubscriptionClient />
        {children}
      </body>
    </html>
  );
}
