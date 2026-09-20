"use client";

import React from 'react';
import NoSignupVaultView from '@/components/NoSignupVaultView';

export default function VaultPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto mb-6 flex justify-between items-center">
        <a href="/" className="text-xs text-cyan-400 hover:underline flex items-center gap-1">
          ← Back to J.A.R.V.I.S. Mission Control
        </a>
      </div>
      <NoSignupVaultView />
    </main>
  );
}
