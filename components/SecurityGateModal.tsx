'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  KeyRound,
  AlertCircle,
  Fingerprint,
  CheckCircle2,
  Lock,
  Loader2,
  ScanFace,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface SecurityGateModalProps {
  isUnlocked: boolean;
  onUnlock: () => void;
}

// Utility: ArrayBuffer <-> Base64URL
function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export const SecurityGateModal: React.FC<SecurityGateModalProps> = ({
  isUnlocked,
  onUnlock,
}) => {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lockoutRemaining, setLockoutRemaining] = useState<number | null>(null);

  // Biometric state
  const [hasBiometricsSupport, setHasBiometricsSupport] = useState(false);
  const [isBiometricsEnrolled, setIsBiometricsEnrolled] = useState(false);
  const [usePasscodeFallback, setUsePasscodeFallback] = useState(false);
  const [showEnrollPrompt, setShowEnrollPrompt] = useState(false);
  const [enrollSuccess, setEnrollSuccess] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available) => {
          setHasBiometricsSupport(available);
          const enrolledId =
            localStorage.getItem('jarvis_bio_cred_id') ||
            localStorage.getItem('jarvis_bio_enrolled');
          if (enrolledId) {
            setIsBiometricsEnrolled(true);
          }
        })
        .catch(() => setHasBiometricsSupport(false));
    }
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutRemaining === null || lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev === null || prev <= 1) {
          setError(false);
          setErrorMessage('');
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  if (isUnlocked && !showEnrollPrompt) return null;

  // 1. Password Verification via Server Sentry
  const handleVerifyPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim() || loading || (lockoutRemaining && lockoutRemaining > 0)) return;

    setLoading(true);
    setError(false);
    setErrorMessage('');

    try {
      const res = await fetch('/api/jarvis/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: pin.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('jarvis_guardian_auth', 'authenticated');
        if (data.token) {
          localStorage.setItem('jarvis_auth_token', data.token);
        }

        // If platform supports biometrics but this device hasn't enrolled yet, prompt enrollment
        if (hasBiometricsSupport && !localStorage.getItem('jarvis_bio_cred_id')) {
          setShowEnrollPrompt(true);
          setLoading(false);
        } else {
          onUnlock();
        }
      } else {
        setError(true);
        if (res.status === 429 && data.remainingSeconds) {
          setLockoutRemaining(data.remainingSeconds);
          setErrorMessage(data.error || 'SECURITY LOCKOUT ENGAGED');
        } else {
          setErrorMessage(data.error || 'ACCESS DENIED // PASSCODE INVALID');
        }
        setPin('');
      }
    } catch (err: any) {
      setError(true);
      setErrorMessage('UPLINK FAILURE // Security gateway unreachable');
    } finally {
      setLoading(false);
    }
  };

  // 2. Biometric Scan (Face ID / Touch ID)
  const handleBiometricAuth = async () => {
    if (biometricLoading || !hasBiometricsSupport) return;
    setBiometricLoading(true);
    setError(false);
    setErrorMessage('');

    try {
      // 1. Request Stateless Challenge from Server
      const challengeRes = await fetch('/api/jarvis/auth/biometric/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: 'mobile-node-primary' }),
      });
      const challengeData = await challengeRes.json();

      if (!challengeRes.ok || !challengeData.challenge) {
        throw new Error('Failed to acquire biometric challenge from server.');
      }

      const enrolledCredId = localStorage.getItem('jarvis_bio_cred_id');
      const bioToken = localStorage.getItem('jarvis_bio_token') || undefined;

      // 2. Prompt Hardware Face ID / Touch ID
      const credential = (await navigator.credentials.get({
        publicKey: {
          challenge: base64UrlToBuffer(challengeData.challenge),
          allowCredentials: enrolledCredId
            ? [
                {
                  id: base64UrlToBuffer(enrolledCredId),
                  type: 'public-key',
                },
              ]
            : undefined,
          userVerification: 'required',
          timeout: 60000,
        },
      })) as PublicKeyCredential;

      if (!credential) throw new Error('Biometric interaction cancelled.');

      const credentialId = bufferToBase64Url(credential.rawId);

      // 3. Verify assertion with server
      const verifyRes = await fetch('/api/jarvis/auth/biometric/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentialId,
          challenge: challengeData.challenge,
          challengeToken: challengeData.challengeToken,
          bioToken,
          deviceId: 'mobile-node-primary',
        }),
      });

      const verifyData = await verifyRes.json();

      if (verifyRes.ok && verifyData.success) {
        localStorage.setItem('jarvis_guardian_auth', 'authenticated');
        localStorage.setItem('jarvis_bio_enrolled', 'true');
        if (verifyData.token) {
          localStorage.setItem('jarvis_auth_token', verifyData.token);
        }
        onUnlock();
      } else {
        setError(true);
        setErrorMessage(verifyData.error || 'Biometric authentication rejected.');
      }
    } catch (err: any) {
      console.warn('Biometric auth error:', err);
      if (err.name !== 'NotAllowedError') {
        setError(true);
        setErrorMessage(err.message || 'Biometric verification failed.');
      }
    } finally {
      setBiometricLoading(false);
    }
  };

  // 3. Enroll This Device's Biometrics
  const handleEnrollBiometrics = async () => {
    setBiometricLoading(true);
    setError(false);

    try {
      const challengeRes = await fetch('/api/jarvis/auth/biometric/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: 'mobile-node-primary' }),
      });
      const challengeData = await challengeRes.json();

      const newCredential = (await navigator.credentials.create({
        publicKey: {
          challenge: base64UrlToBuffer(challengeData.challenge),
          rp: { name: 'J.A.R.V.I.S. Core Matrix' },
          user: {
            id: new TextEncoder().encode('harshan-creator-id'),
            name: 'harshan',
            displayName: 'Sir (Creator)',
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' }, // ES256
            { alg: -257, type: 'public-key' }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred',
          },
          timeout: 60000,
        },
      })) as PublicKeyCredential;

      if (!newCredential) throw new Error('Enrollment cancelled.');

      const credentialId = bufferToBase64Url(newCredential.rawId);

      const regRes = await fetch('/api/jarvis/auth/biometric/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentialId,
          deviceName: navigator.userAgent.includes('iPhone')
            ? 'iPhone Face ID'
            : navigator.userAgent.includes('Android')
            ? 'Android Biometrics'
            : 'Workstation Biometrics',
          challenge: challengeData.challenge,
          challengeToken: challengeData.challengeToken,
          deviceId: 'mobile-node-primary',
        }),
      });

      const regData = await regRes.json();

      if (regRes.ok && regData.success) {
        localStorage.setItem('jarvis_bio_cred_id', credentialId);
        localStorage.setItem('jarvis_bio_enrolled', 'true');
        if (regData.bioToken) {
          localStorage.setItem('jarvis_bio_token', regData.bioToken);
        }
        setIsBiometricsEnrolled(true);
        setEnrollSuccess(true);
        setTimeout(() => {
          setShowEnrollPrompt(false);
          onUnlock();
        }, 1200);
      } else {
        throw new Error(regData.error || 'Failed to register biometric node.');
      }
    } catch (err: any) {
      console.error('Enrollment error:', err);
      // If user cancelled, just proceed into dashboard
      setShowEnrollPrompt(false);
      onUnlock();
    } finally {
      setBiometricLoading(false);
    }
  };

  // Post-Login Biometric Enrollment Modal
  if (showEnrollPrompt) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fadeIn">
        <div className="relative w-full max-w-sm bg-slate-950 border border-cyan-500/60 rounded-2xl p-6 shadow-[0_0_60px_rgba(0,229,255,0.3)] text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-cyan-950/80 border border-cyan-400 flex items-center justify-center mb-4 shadow-[0_0_25px_rgba(0,229,255,0.5)]">
            <Fingerprint className="w-8 h-8 text-cyan-400 animate-pulse" />
          </div>

          <h2 className="font-mono text-base font-black tracking-widest text-cyan-300 uppercase">
            BIOMETRIC UPLINK DETECTED
          </h2>
          <p className="text-[11px] font-mono text-slate-400 mt-2 mb-6">
            Would you like to link Face ID / Fingerprint on this device for 1-tap instant biometric unlock?
          </p>

          {enrollSuccess ? (
            <div className="py-4 text-emerald-400 font-mono text-xs flex items-center justify-center space-x-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>BIOMETRIC MATRIX ENROLLED</span>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={handleEnrollBiometrics}
                disabled={biometricLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(0,229,255,0.4)] flex items-center justify-center space-x-2"
              >
                {biometricLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                ) : (
                  <>
                    <Fingerprint className="w-4 h-4 text-black" />
                    <span>ENROLL FACE ID / FINGERPRINT</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  setShowEnrollPrompt(false);
                  onUnlock();
                }}
                className="w-full py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 font-mono text-[11px] uppercase tracking-wider transition-colors"
              >
                SKIP FOR NOW
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. Primary Biometric Mode (When enrolled on phone / workstation)
  if (isBiometricsEnrolled && !usePasscodeFallback) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fadeIn">
        <div className="relative w-full max-w-sm bg-slate-950 border border-cyan-500/50 rounded-2xl p-6 shadow-[0_0_70px_rgba(0,229,255,0.3)] text-center">
          {/* Animated Arc Reactor Core Biometric Scanner */}
          <div className="relative mx-auto w-24 h-24 mb-6 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-cyan-500/30 animate-ping opacity-30" />
            <div className="absolute inset-1 rounded-full border-2 border-dashed border-cyan-400/60 animate-spin-slow" />
            <button
              onClick={handleBiometricAuth}
              disabled={biometricLoading}
              className="relative w-20 h-20 rounded-full bg-cyan-950/80 border-2 border-cyan-400 flex items-center justify-center shadow-[0_0_30px_rgba(0,229,255,0.5)] active:scale-95 transition-transform group"
            >
              {biometricLoading ? (
                <Loader2 className="w-9 h-9 animate-spin text-cyan-300" />
              ) : (
                <ScanFace className="w-9 h-9 text-cyan-400 group-hover:scale-110 transition-transform animate-pulse" />
              )}
            </button>
          </div>

          <h2 className="font-mono text-base font-black tracking-widest text-cyan-300 uppercase">
            J.A.R.V.I.S. LOCKED
          </h2>
          <p className="text-[11px] font-mono text-slate-400 mt-1 mb-6">
            DIRECTIVE 01 ENFORCED // FACE ID AUTHENTICATION
          </p>

          {error && (
            <div className="mb-4 text-[11px] font-mono text-red-400 flex items-center justify-center space-x-1 animate-shake">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Big Tap to Unlock Button */}
          <button
            onClick={handleBiometricAuth}
            disabled={biometricLoading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-cyan-400 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_25px_rgba(0,229,255,0.5)] flex items-center justify-center space-x-2"
          >
            {biometricLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-black" />
            ) : (
              <>
                <Fingerprint className="w-4 h-4 text-black" />
                <span>TAP TO UNLOCK (FACE ID)</span>
              </>
            )}
          </button>

          {/* Fallback to Passcode */}
          <div className="mt-5 pt-4 border-t border-slate-800/80">
            <button
              onClick={() => {
                setUsePasscodeFallback(true);
                setError(false);
              }}
              className="text-[11px] font-mono text-slate-400 hover:text-cyan-300 transition-colors flex items-center justify-center space-x-1 mx-auto"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>UNLOCK WITH MASTER PASSCODE</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 5. Passcode Form (Initial or Fallback Mode)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-sm bg-slate-950 border border-cyan-500/50 rounded-2xl p-6 shadow-[0_0_60px_rgba(0,229,255,0.25)] text-center">
        {/* Glowing Shield Icon */}
        <div className="mx-auto w-16 h-16 rounded-full bg-cyan-950/80 border border-cyan-400 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(0,229,255,0.4)]">
          <ShieldAlert className="w-8 h-8 text-cyan-400 animate-pulse" />
        </div>

        <h2 className="font-mono text-base font-black tracking-widest text-cyan-300 uppercase">
          GUARDIAN SECURITY GATE
        </h2>
        <p className="text-[11px] font-mono text-slate-400 mt-1 mb-5">
          DIRECTIVE 01 ENFORCED // VERIFY CREATOR IDENTITY
        </p>

        {/* Instant Biometric Button If Supported */}
        {hasBiometricsSupport && (
          <div className="mb-5 pb-5 border-b border-slate-800">
            <button
              onClick={handleBiometricAuth}
              disabled={biometricLoading || (lockoutRemaining !== null && lockoutRemaining > 0)}
              className="w-full py-3 rounded-xl bg-cyan-950/60 border border-cyan-500/60 hover:border-cyan-400 hover:bg-cyan-900/40 text-cyan-300 font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(0,229,255,0.2)] flex items-center justify-center space-x-2 group"
            >
              {biometricLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              ) : (
                <>
                  <Fingerprint className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span>ONE-TAP BIOMETRIC SCAN</span>
                </>
              )}
            </button>
            <p className="text-[10px] font-mono text-slate-500 mt-2">
              Face ID • Fingerprint • Windows Hello
            </p>
          </div>
        )}

        {/* Master Passphrase Form */}
        <form onSubmit={handleVerifyPasscode} className="space-y-4">
          <div className="relative">
            <KeyRound className="w-4 h-4 text-cyan-400 absolute left-3 top-3" />
            <input
              type="password"
              placeholder={hasBiometricsSupport ? 'OR ENTER MASTER KEY...' : 'ENTER MASTER KEY...'}
              value={pin}
              disabled={loading || (lockoutRemaining !== null && lockoutRemaining > 0)}
              onChange={(e) => {
                setPin(e.target.value);
                if (error) setError(false);
              }}
              autoFocus={!hasBiometricsSupport}
              className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-xl pl-10 pr-4 py-2.5 text-center font-mono tracking-widest text-slate-100 placeholder-slate-600 focus:outline-none text-sm shadow-inner disabled:opacity-50"
            />
          </div>

          {error && (
            <div className="text-[11px] font-mono text-red-400 flex items-center justify-center space-x-1 animate-shake">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {lockoutRemaining !== null && lockoutRemaining > 0 && (
            <div className="p-2.5 rounded-lg bg-red-950/50 border border-red-500/50 text-[11px] font-mono text-red-300">
              ANTI-BRUTE-FORCE LOCKOUT: {lockoutRemaining}s
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (lockoutRemaining !== null && lockoutRemaining > 0)}
            className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-600 text-black font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(0,229,255,0.4)] flex items-center justify-center space-x-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span>AUTHORIZE UPLINK</span>
            )}
          </button>
        </form>

        {isBiometricsEnrolled && (
          <div className="mt-4 pt-3 border-t border-slate-800">
            <button
              onClick={() => {
                setUsePasscodeFallback(false);
                setError(false);
              }}
              className="text-[11px] font-mono text-cyan-400 hover:underline"
            >
              ← Back to Face ID Scan
            </button>
          </div>
        )}

        <div className="mt-4 flex items-center justify-center space-x-1 text-[10px] font-mono text-slate-500">
          <Lock className="w-3 h-3 text-cyan-500/70" />
          <span>Server Sentry • Edge Cryptographic Verification</span>
        </div>
      </div>
    </div>
  );
};
