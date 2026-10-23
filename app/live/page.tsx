'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import {
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  Shield,
  Zap,
  Activity,
  Sparkles,
  Maximize2,
  Lock,
  Headphones,
  Radio,
  ArrowLeft,
  Flame,
} from 'lucide-react';

type Persona = 'friday' | 'jarvis';
type UplinkState = 'idle' | 'listening' | 'recording' | 'thinking' | 'speaking';

interface VoiceMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  persona?: Persona;
  tools?: string[];
  latencyMs?: number;
}

export default function LiveVoicePage() {
  const router = useRouter();

  // Core States
  const [persona, setPersona] = useState<Persona>('friday');
  const [uplinkState, setUplinkState] = useState<UplinkState>('idle');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [speechRate, setSpeechRate] = useState<number>(1.1);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [interimText, setInterimText] = useState<string>('');
  const [isTelegramMiniApp, setIsTelegramMiniApp] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('Voice Engine Ready • Tap Orb to Connect');
  const [detectedMime, setDetectedMime] = useState<string>('');

  // Audio / WebRTC Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isRecordingSpeechRef = useRef<boolean>(false);
  const speechStartTimeRef = useRef<number>(0);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSpeechTimeRef = useRef<number>(0);
  const recognitionRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);
  const transcriptBottomRef = useRef<HTMLDivElement | null>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const ttsWatchdogRef = useRef<NodeJS.Timeout | null>(null);
  const mimeTypeRef = useRef<string>('audio/webm');

  // Sync isSpeakingRef with state
  useEffect(() => {
    isSpeakingRef.current = uplinkState === 'speaking';
  }, [uplinkState]);

  // Determine best supported Audio MIME type across iOS Safari / Android / Desktop
  const getSupportedMimeType = useCallback(() => {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg',
      'audio/wav',
    ];
    for (const c of candidates) {
      try {
        if (MediaRecorder.isTypeSupported(c)) return c;
      } catch {}
    }
    return '';
  }, []);

  // Telegram Mini App Initialization & Screen WakeLock
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mime = getSupportedMimeType();
      mimeTypeRef.current = mime;
      setDetectedMime(mime || 'none');

      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        setIsTelegramMiniApp(true);
        tg.ready?.();
        tg.expand?.();
        tg.enableClosingConfirmation?.();
        if (tg.setHeaderColor) tg.setHeaderColor('#030712');
        if (tg.setBackgroundColor) tg.setBackgroundColor('#030712');
      }

      // Request Screen Wake Lock so phone stays awake in pocket/car mount
      const requestWakeLock = async () => {
        try {
          if ('wakeLock' in navigator) {
            wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          }
        } catch {}
      };
      requestWakeLock();
    }

    return () => {
      stopAudioPipeline();
      if (wakeLockRef.current) {
        try { wakeLockRef.current.release(); } catch {}
      }
    };
  }, [getSupportedMimeType]);

  // Trigger Telegram Haptic Feedback
  const triggerHaptic = (style: 'light' | 'medium' | 'heavy' | 'selection' = 'medium') => {
    if (typeof window !== 'undefined') {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.HapticFeedback) {
        if (style === 'selection') tg.HapticFeedback.selectionChanged();
        else tg.HapticFeedback.impactOccurred(style);
      } else if (navigator.vibrate) {
        navigator.vibrate(style === 'heavy' ? 40 : 20);
      }
    }
  };

  // Scroll transcript to bottom
  useEffect(() => {
    transcriptBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, interimText]);

  // Barge-In Speech Interruption Protocol
  const handleBargeIn = useCallback(() => {
    if (isSpeakingRef.current) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (ttsWatchdogRef.current) clearInterval(ttsWatchdogRef.current);
      isSpeakingRef.current = false;
      setUplinkState('listening');
      setStatusMessage('Listening... Speak anytime (Barge-in armed)');
      triggerHaptic('heavy');
    }
  }, []);

  // Handle Assistant Vocal Synthesis with iOS Safari Anti-GC Watchdog
  const vocalizeResponse = useCallback(
    (vocalText: string, fullReply: string, tools: any[], latencyMs: number) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        setUplinkState('listening');
        setStatusMessage('Listening... Speak anytime (Barge-in armed)');
        return;
      }

      window.speechSynthesis.cancel();
      if (ttsWatchdogRef.current) clearInterval(ttsWatchdogRef.current);

      setUplinkState('speaking');
      setStatusMessage('Speaking • Tap or speak to interrupt');
      isSpeakingRef.current = true;

      const utterance = new SpeechSynthesisUtterance(vocalText);
      activeUtteranceRef.current = utterance; // Retain reference to prevent iOS GC freeze
      utterance.rate = speechRate;
      utterance.pitch = persona === 'friday' ? 1.05 : 0.95;

      // Prefer British / Irish English voices
      const voices = window.speechSynthesis.getVoices();
      const britishVoice = voices.find(
        (v) =>
          v.name.includes('Daniel') ||
          v.name.includes('George') ||
          v.name.includes('UK English Male') ||
          (persona === 'friday' &&
            (v.name.includes('Martha') ||
              v.name.includes('Moira') ||
              v.name.includes('UK English Female') ||
              v.lang === 'en-IE' ||
              v.lang === 'en-GB')) ||
          v.lang === 'en-GB' ||
          v.lang === 'en-IE'
      );
      if (britishVoice) utterance.voice = britishVoice;

      const cleanupUtterance = () => {
        if (ttsWatchdogRef.current) clearInterval(ttsWatchdogRef.current);
        isSpeakingRef.current = false;
        setUplinkState('listening');
        setStatusMessage('Listening... Speak anytime (Barge-in armed)');
      };

      utterance.onstart = () => {
        setUplinkState('speaking');
        isSpeakingRef.current = true;
        triggerHaptic('light');
      };

      utterance.onend = cleanupUtterance;
      utterance.onerror = cleanupUtterance;

      // iOS Safari Watchdog: verify speaking state doesn't hang silently
      ttsWatchdogRef.current = setInterval(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          if (!window.speechSynthesis.speaking && isSpeakingRef.current) {
            cleanupUtterance();
          }
        }
      }, 400);

      window.speechSynthesis.speak(utterance);

      // Append Assistant turn to transcript
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-a`,
          sender: 'agent',
          text: vocalText,
          persona,
          tools: tools.map((t) => t.name),
          latencyMs,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    },
    [persona, speechRate]
  );

  // Dispatch Raw Audio Buffer directly to Groq Whisper & Friday Agent
  const dispatchAudioChunk = useCallback(
    async (audioBlob: Blob) => {
      if (!audioBlob || audioBlob.size < 400) {
        setUplinkState('listening');
        setStatusMessage('Listening... Speak anytime (Barge-in armed)');
        return;
      }

      setUplinkState('thinking');
      setStatusMessage('⚡ Groq Whisper LPU Transcribing & Reasoning...');
      triggerHaptic('medium');

      try {
        const formData = new FormData();
        const extension = mimeTypeRef.current.includes('mp4') ? 'voice.m4a' : 'voice.webm';
        formData.append('file', audioBlob, extension);
        formData.append('persona', persona);

        const res = await fetch('/api/jarvis/voice/chat', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          throw new Error(`Voice endpoint error (HTTP ${res.status})`);
        }

        const data = await res.json();

        // If silence or empty audio was returned
        if (data.silence || !data.transcript) {
          setUplinkState('listening');
          setStatusMessage('Listening... Speak anytime (Barge-in armed)');
          return;
        }

        // Log user speech to transcript immediately
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-u`,
            sender: 'user',
            text: data.transcript,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);

        // Vocalize Friday's response
        vocalizeResponse(
          data.vocalText,
          data.fullMarkdownReply,
          data.toolCallsExecuted || [],
          data.latencyMs || 0
        );
      } catch (err: any) {
        console.error('[Live Voice] Dispatch failed:', err);
        const fallback =
          persona === 'friday'
            ? 'Tactical reflex timeout, Sir. Re-establishing link.'
            : 'Pardon me, Sir. Audio connection hesitated. Standing by.';
        vocalizeResponse(fallback, fallback, [], 0);
      }
    },
    [persona, vocalizeResponse]
  );

  // Stop active speech recording segment and send to Whisper
  const finalizeSpeechSegment = useCallback(() => {
    if (!isRecordingSpeechRef.current) return;
    isRecordingSpeechRef.current = false;

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      try {
        recorder.stop();
      } catch (err) {
        console.warn('[Live Voice] Recorder stop warning:', err);
      }
    }
  }, []);

  // Start active speech recording segment
  const startSpeechSegment = useCallback(() => {
    if (isRecordingSpeechRef.current || isSpeakingRef.current || uplinkState === 'thinking') return;

    try {
      if (mediaStreamRef.current && mediaRecorderRef.current) {
        const recorder = mediaRecorderRef.current;
        if (recorder.state === 'inactive') {
          audioChunksRef.current = [];
          speechStartTimeRef.current = Date.now();
          isRecordingSpeechRef.current = true;
          setUplinkState('recording');
          setStatusMessage('🎙️ Hearing speech... Speak naturally');
          triggerHaptic('light');
          recorder.start(150);
        }
      }
    } catch (err) {
      console.warn('[Live Voice] Failed to start recorder segment:', err);
    }
  }, [uplinkState]);

  // Setup Continuous MediaRecorder with automatic chunk recycling
  const setupMediaRecorder = (stream: MediaStream) => {
    try {
      const mime = mimeTypeRef.current || 'audio/webm';
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const totalDuration = Date.now() - speechStartTimeRef.current;
        const chunks = [...audioChunksRef.current];
        audioChunksRef.current = [];

        if (chunks.length > 0 && totalDuration > 350) {
          const blob = new Blob(chunks, { type: mimeTypeRef.current || 'audio/webm' });
          dispatchAudioChunk(blob);
        } else {
          setUplinkState('listening');
          setStatusMessage('Listening... Speak anytime (Barge-in armed)');
        }
      };

      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.error('[Live Voice] MediaRecorder setup error:', err);
    }
  };

  // Start Full-Duplex Microphone & Web Audio Spectrum
  const startAudioPipeline = async () => {
    try {
      triggerHaptic('heavy');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // 1. Setup MediaRecorder for Cloud Whisper VAD
      setupMediaRecorder(stream);

      // 2. Initialize Web Audio Context for Spectrum Analysis & VAD
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      analyserRef.current = analyser;

      // 3. Fallback Web Speech Recognition for Real-time Interim Display (if browser allows)
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        try {
          const recognition = new SpeechRec();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event: any) => {
            let liveTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              liveTranscript += event.results[i][0].transcript;
            }
            if (liveTranscript.trim().length > 1 && isSpeakingRef.current) {
              handleBargeIn();
            }
            setInterimText(liveTranscript);
          };

          recognition.onerror = () => {};
          recognition.onend = () => {
            if (mediaStreamRef.current && !isMicMuted) {
              try { recognition.start(); } catch {}
            }
          };

          recognitionRef.current = recognition;
          recognition.start();
        } catch {}
      }

      setUplinkState('listening');
      setStatusMessage('Listening... Speak anytime (Barge-in armed)');
      drawVisualizerSpectrum();

      // Vocal Greeting
      const greeting =
        persona === 'friday'
          ? 'Live uplink established. Friday standing by.'
          : 'Good day, Sir. Jarvis at your service. Full-duplex voice active.';
      vocalizeResponse(greeting, greeting, [], 0);
    } catch (err: any) {
      console.error('[Live Voice] Failed to acquire microphone:', err);
      alert('Microphone access is required for the Live Voice Uplink. Please grant microphone permission.');
    }
  };

  // Stop Audio Pipeline & End Call
  const stopAudioPipeline = () => {
    triggerHaptic('heavy');
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (ttsWatchdogRef.current) clearInterval(ttsWatchdogRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    isRecordingSpeechRef.current = false;

    if (mediaRecorderRef.current) {
      try { mediaRecorderRef.current.stop(); } catch {}
      mediaRecorderRef.current = null;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setUplinkState('idle');
    setStatusMessage('Voice Engine Ready • Tap Orb to Connect');
    setAudioLevel(0);
  };

  // Close Session or Return
  const handleExit = () => {
    stopAudioPipeline();
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.close) {
      tg.close();
    } else {
      router.push('/');
    }
  };

  // Canvas Holographic Visualizer Loop with VAD Voice Activity Detection
  const drawVisualizerSpectrum = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const SPEECH_THRESHOLD = 18; // Volume threshold for speech detection
    const SILENCE_DEBOUNCE_MS = 850; // Trailing silence before dispatching to Whisper

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const avg = sum / bufferLength;
      setAudioLevel(avg);

      const now = Date.now();

      // ==========================================================
      // VAD Voice Activity Detection State Machine
      // ==========================================================
      if (!isMicMuted) {
        // 1. User Voice Activity Detected
        if (avg > SPEECH_THRESHOLD) {
          lastSpeechTimeRef.current = now;

          // Barge-in check: If Friday is vocalizing, user speech interrupts her immediately
          if (isSpeakingRef.current) {
            handleBargeIn();
          }

          // If not currently recording and not thinking, trigger recorder
          if (!isRecordingSpeechRef.current && !isSpeakingRef.current && uplinkState !== 'thinking') {
            startSpeechSegment();
          }

          // Clear any pending silence timer
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else {
          // 2. Trailing Silence Detected while actively recording
          if (isRecordingSpeechRef.current && !silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              silenceTimerRef.current = null;
              if (isRecordingSpeechRef.current) {
                finalizeSpeechSegment();
              }
            }, SILENCE_DEBOUNCE_MS);
          }
        }
      }

      // ==========================================================
      // Visualizer Canvas Rendering
      // ==========================================================
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      const isSpeaking = isSpeakingRef.current;
      const isThinking = uplinkState === 'thinking';
      const isRecording = uplinkState === 'recording' || isRecordingSpeechRef.current;

      const baseColor = isThinking
        ? 'rgba(168, 85, 247, ' // Purple
        : isSpeaking
        ? 'rgba(16, 185, 129, ' // Emerald
        : isRecording
        ? 'rgba(239, 68, 68, ' // Red / Coral (Active Recording)
        : 'rgba(6, 182, 212, '; // Cyan (Listening)

      // Center Arc Reactor Core Glow
      const coreRadius = 55 + (avg / 255) * 30;
      const gradient = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, coreRadius * 1.6);
      gradient.addColorStop(0, `${baseColor}0.9)`);
      gradient.addColorStop(0.5, `${baseColor}0.4)`);
      gradient.addColorStop(1, `${baseColor}0)`);

      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius * 1.6, 0, 2 * Math.PI);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Outer Radial Waveform Bars
      const bars = 48;
      const angleStep = (2 * Math.PI) / bars;
      for (let i = 0; i < bars; i++) {
        const value = dataArray[i % bufferLength] || 8;
        const barHeight = Math.max(8, (value / 255) * 75);
        const angle = i * angleStep;

        const x1 = centerX + Math.cos(angle) * (coreRadius + 4);
        const y1 = centerY + Math.sin(angle) * (coreRadius + 4);
        const x2 = centerX + Math.cos(angle) * (coreRadius + 4 + barHeight);
        const y2 = centerY + Math.sin(angle) * (coreRadius + 4 + barHeight);

        ctx.strokeStyle = `${baseColor}${Math.max(0.4, value / 255)})`;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Concentric Dashed Tactical Rings
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(Date.now() * 0.0006);
      ctx.strokeStyle = `${baseColor}0.35)`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 12]);
      ctx.beginPath();
      ctx.arc(0, 0, coreRadius + 85, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();
    };

    render();
  };

  // Center Orb Click Handler: Starts call or finishes speech immediately
  const handleOrbClick = () => {
    triggerHaptic('medium');
    if (uplinkState === 'idle') {
      startAudioPipeline();
    } else if (uplinkState === 'speaking') {
      handleBargeIn();
    } else if (isRecordingSpeechRef.current) {
      // Tap while speaking sends immediately to Whisper
      finalizeSpeechSegment();
    } else if (uplinkState === 'listening') {
      // Force-start a recording segment
      startSpeechSegment();
    }
  };

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />

      <main className="fixed inset-0 bg-[#030712] text-white flex flex-col justify-between overflow-hidden select-none font-sans">
        {/* Top Header HUD */}
        <header className="px-5 py-3.5 border-b border-cyan-500/20 bg-slate-950/80 backdrop-blur-md flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={handleExit}
              className="p-2 rounded-lg bg-slate-900/80 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-950/40 transition active:scale-95"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest font-mono text-cyan-400 font-bold">
                  {persona === 'friday' ? '🛡️ F.R.I.D.A.Y.' : '⚡ J.A.R.V.I.S.'}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950/70 border border-cyan-500/40 text-cyan-300">
                  WHISPER LPU
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                {isTelegramMiniApp ? 'Telegram Sovereign Uplink' : 'AirPods / Hands-Free Mode'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Persona Switcher */}
            <div className="flex bg-slate-900/80 p-0.5 rounded-lg border border-cyan-500/30">
              <button
                onClick={() => {
                  setPersona('friday');
                  triggerHaptic('selection');
                }}
                className={`px-2.5 py-1 text-xs font-mono rounded-md transition ${
                  persona === 'friday'
                    ? 'bg-purple-600/90 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Friday
              </button>
              <button
                onClick={() => {
                  setPersona('jarvis');
                  triggerHaptic('selection');
                }}
                className={`px-2.5 py-1 text-xs font-mono rounded-md transition ${
                  persona === 'jarvis'
                    ? 'bg-cyan-600/90 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Jarvis
              </button>
            </div>

            {/* End / Disconnect */}
            <button
              onClick={handleExit}
              className="p-2 rounded-lg bg-red-950/60 border border-red-500/40 text-red-400 hover:bg-red-900/60 transition active:scale-95"
              title="Disconnect"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Central Orb & Spectrum Visualizer */}
        <section className="flex-1 flex flex-col items-center justify-center relative px-4">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-950/20 via-slate-950/60 to-[#030712] pointer-events-none" />

          {/* Interactive Visualizer Canvas */}
          <div className="relative flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={340}
              height={340}
              className="w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] cursor-pointer"
              onClick={handleOrbClick}
            />

            {/* Core Interactive Center Tap Target */}
            <div
              onClick={handleOrbClick}
              className={`absolute w-24 h-24 rounded-full flex flex-col items-center justify-center cursor-pointer transition-all duration-300 shadow-2xl ${
                uplinkState === 'idle'
                  ? 'bg-gradient-to-br from-slate-900 to-cyan-950 border border-cyan-500/40 hover:scale-105 active:scale-95'
                  : uplinkState === 'thinking'
                  ? 'bg-gradient-to-br from-purple-900 to-slate-950 border border-purple-500/60 scale-105 animate-pulse'
                  : uplinkState === 'speaking'
                  ? 'bg-gradient-to-br from-emerald-900 to-slate-950 border border-emerald-500/60 ring-2 ring-emerald-400/40'
                  : uplinkState === 'recording' || isRecordingSpeechRef.current
                  ? 'bg-gradient-to-br from-red-900 to-slate-950 border border-red-500/80 ring-2 ring-red-400/60 scale-105 animate-pulse'
                  : 'bg-gradient-to-br from-cyan-900 to-slate-950 border border-cyan-400/80 ring-2 ring-cyan-400/30'
              }`}
            >
              {uplinkState === 'idle' ? (
                <>
                  <Mic className="w-8 h-8 text-cyan-400 animate-bounce mb-1" />
                  <span className="text-[10px] font-mono text-cyan-300 tracking-wider">TAP TO CALL</span>
                </>
              ) : uplinkState === 'thinking' ? (
                <>
                  <Sparkles className="w-8 h-8 text-purple-300 animate-spin mb-1" />
                  <span className="text-[9px] font-mono text-purple-300">WHISPER LPU</span>
                </>
              ) : uplinkState === 'speaking' ? (
                <>
                  <Volume2 className="w-8 h-8 text-emerald-300 animate-pulse mb-1" />
                  <span className="text-[9px] font-mono text-emerald-300">SPEAKING</span>
                </>
              ) : uplinkState === 'recording' || isRecordingSpeechRef.current ? (
                <>
                  <Flame className="w-8 h-8 text-red-400 animate-bounce mb-1" />
                  <span className="text-[9px] font-mono text-red-300">HEARING YOU</span>
                </>
              ) : (
                <>
                  <Radio className="w-8 h-8 text-cyan-300 animate-pulse mb-1" />
                  <span className="text-[9px] font-mono text-cyan-300">LISTENING</span>
                </>
              )}
            </div>
          </div>

          {/* Real-time Status Badge */}
          <div className="mt-4 flex items-center gap-2 font-mono text-xs text-slate-300 bg-slate-900/60 border border-cyan-500/20 px-3.5 py-1.5 rounded-full backdrop-blur-sm">
            <span
              className={`w-2 h-2 rounded-full ${
                uplinkState === 'idle'
                  ? 'bg-slate-500'
                  : uplinkState === 'thinking'
                  ? 'bg-purple-400 animate-ping'
                  : uplinkState === 'speaking'
                  ? 'bg-emerald-400 animate-pulse'
                  : uplinkState === 'recording' || isRecordingSpeechRef.current
                  ? 'bg-red-400 animate-ping'
                  : 'bg-cyan-400 animate-pulse'
              }`}
            />
            {statusMessage}
          </div>

          {/* Live User Speech Interim */}
          {interimText && (
            <div className="mt-3 max-w-sm px-4 py-2 rounded-xl bg-cyan-950/60 border border-cyan-400/40 text-cyan-200 text-xs font-mono text-center shadow-lg animate-fade-in">
              &ldquo;{interimText}&rdquo;
            </div>
          )}
        </section>

        {/* Live Transcript Drawer */}
        <section className="h-44 sm:h-52 bg-slate-950/90 border-t border-cyan-500/20 px-4 py-3 flex flex-col justify-between overflow-hidden backdrop-blur-md z-10">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              Real-Time Tactical Transcript
            </span>
            <span className="text-[10px] text-slate-500">
              {messages.length} exchanges
            </span>
          </div>

          {/* Transcript Scroll Area */}
          <div className="flex-1 overflow-y-auto py-2 space-y-2 pr-1 text-xs">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-center font-mono text-xs">
                No active transcript yet. Speak into your AirPods or tap the Orb to start.
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-xl font-sans ${
                      m.sender === 'user'
                        ? 'bg-cyan-600/30 border border-cyan-500/40 text-cyan-100 rounded-br-none'
                        : 'bg-slate-900 border border-slate-700/60 text-slate-200 rounded-bl-none'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5 text-[10px] font-mono text-slate-400">
                      <span>{m.sender === 'user' ? 'Sir' : m.persona === 'friday' ? '🛡️ Friday' : '⚡ Jarvis'}</span>
                      <span>•</span>
                      <span>{m.timestamp}</span>
                      {m.latencyMs ? (
                        <span className="text-cyan-400 font-mono text-[9px]">({m.latencyMs}ms)</span>
                      ) : null}
                    </div>
                    <p className="leading-relaxed">{m.text}</p>
                    {m.tools && m.tools.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {m.tools.map((tool, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-purple-950/60 border border-purple-500/40 text-purple-300"
                          >
                            ⚡ {tool}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={transcriptBottomRef} />
          </div>

          {/* Bottom Tactical Controls Ribbon */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
              <Headphones className="w-3.5 h-3.5 text-cyan-400" />
              <span>Barge-in: Active</span>
              <span className="text-[10px] text-cyan-500/60">({detectedMime.replace(/;.*$/, '')})</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Playback Speed Rate */}
              <button
                onClick={() => {
                  const nextRate = speechRate === 1.0 ? 1.15 : speechRate === 1.15 ? 1.25 : 1.0;
                  setSpeechRate(nextRate);
                  triggerHaptic('selection');
                }}
                className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300 hover:text-white"
                title="Playback vocal speed"
              >
                {speechRate}x
              </button>

              {/* Mic Mute Toggle */}
              <button
                onClick={() => {
                  setIsMicMuted(!isMicMuted);
                  triggerHaptic('medium');
                }}
                className={`p-1.5 rounded-lg border text-xs transition ${
                  isMicMuted
                    ? 'bg-amber-950/60 border-amber-500/40 text-amber-400'
                    : 'bg-slate-900 border-slate-700 text-slate-300'
                }`}
                title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
              >
                {isMicMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
