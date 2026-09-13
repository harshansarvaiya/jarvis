'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, Lock, Unlock, KeyRound, AlertCircle } from 'lucide-react';

interface SecurityGateModalProps {
  isUnlocked: boolean;
  onUnlock: () => void;
}

export const SecurityGateModal: React.FC<SecurityGateModalProps> = ({
  isUnlocked,
  onUnlock,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (isUnlocked) return null;

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const storedPin = localStorage.getItem('jarvis_master_pin') || '1010';
    if (pin.trim() === storedPin) {
      localStorage.setItem('jarvis_guardian_auth', 'authenticated');
      setError(false);
      onUnlock();
    } else {
      setError(true);
      setErrorMessage('ACCESS DENIED // PASSCODE INVALID');
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-sm bg-slate-950 border border-cyan-500/50 rounded-2xl p-6 shadow-[0_0_60px_rgba(0,229,255,0.25)] text-center">
        {/* Glowing Lock Icon */}
        <div className="mx-auto w-16 h-16 rounded-full bg-cyan-950/80 border border-cyan-400 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(0,229,255,0.4)]">
          <ShieldAlert className="w-8 h-8 text-cyan-400 animate-pulse" />
        </div>

        <h2 className="font-mono text-base font-black tracking-widest text-cyan-300 uppercase">
          GUARDIAN SECURITY GATE
        </h2>
        <p className="text-[11px] font-mono text-slate-400 mt-1 mb-5">
          DIRECTIVE 01 ENFORCED // VERIFY CREATOR IDENTITY
        </p>

        <form onSubmit={handleVerify} className="space-y-4">
          <div className="relative">
            <KeyRound className="w-4 h-4 text-cyan-400 absolute left-3 top-3" />
            <input
              type="password"
              maxLength={12}
              placeholder="ENTER PASSCODE..."
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                if (error) setError(false);
              }}
              autoFocus
              className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-xl pl-10 pr-4 py-2.5 text-center font-mono tracking-widest text-slate-100 placeholder-slate-600 focus:outline-none text-sm shadow-inner"
            />
          </div>

          {error && (
            <div className="text-[11px] font-mono text-red-400 flex items-center justify-center space-x-1 animate-shake">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(0,229,255,0.4)]"
          >
            AUTHORIZE UPLINK
          </button>
        </form>

        <p className="mt-4 text-[10px] font-mono text-slate-500">
          Default Genesis Passcode: <span className="text-cyan-400 font-bold">1010</span> (Configurable in Settings)
        </p>
      </div>
    </div>
  );
};
