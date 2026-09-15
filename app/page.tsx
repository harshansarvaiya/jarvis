'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Send,
  Camera,
  Settings as SettingsIcon,
  Sparkles,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  Volume2,
  RefreshCw,
  Terminal,
  Zap,
  CheckSquare,
  Brain,
  ShieldCheck,
  MessageSquare,
  Trash2,
  Bell,
  BellRing,
  FileText,
  X,
  File,
  Check,
  ChevronDown,
} from 'lucide-react';
import { ArcReactorOrb } from '@/components/ArcReactorOrb';
import { DirectiveBadge } from '@/components/DirectiveBadge';
import { TaskMatrix } from '@/components/TaskMatrix';
import { MemoryVault } from '@/components/MemoryVault';
import { SystemHealthMatrix } from '@/components/SystemHealthMatrix';
import { SettingsModal } from '@/components/SettingsModal';
import { SecurityGateModal } from '@/components/SecurityGateModal';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { Task, Priority, MemoryItem, MemoryCategory } from '@/lib/jarvis/memory';
import { triggerDeviceNotification, playJarvisNotificationChime } from '@/lib/jarvis/notifications';

// Fix 4: Convert server-emitted ISO UTC timestamp to device local time
function formatLocalTimestamp(isoOrTimeStr: string): string {
  try {
    const d = new Date(isoOrTimeStr);
    if (isNaN(d.getTime())) return isoOrTimeStr; // Not a valid ISO — return as-is
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoOrTimeStr;
  }
}

// Fix 5: Mobile Safari socket resilience — silently retries on TCP connection drops
async function fetchWithRetry(url: string, opts: RequestInit, retries = 2): Promise<Response> {
  let lastErr: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, opts);
    } catch (err: any) {
      lastErr = err;
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, 700)); // 700ms backoff before retry
      }
    }
  }
  throw lastErr;
}


interface AttachedDoc {
  name: string;
  size: number;
  type: string;
  content: string;
  isText: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  image?: string;
  document?: {
    name: string;
    size: number;
    type: string;
  };
  toolCalls?: Array<{ name: string; args: any; result: any }>;
  timestamp: string;
  vocalSummary?: string;
  tacticalActions?: string[];
  telemetry?: any;
}

const INITIAL_WELCOME_MESSAGE: Message = {
  id: 'welcome-1',
  role: 'assistant',
  content:
    'Good evening, Sir. J.A.R.V.I.S. Mark I is online and synchronized. All four Core Directives — Guardian Protocol, Benevolent Alignment, Evolutionary Adaptation, and Sovereign Loyalty — are actively governing our operations. I stand ready to execute your orders with absolute fidelity at any cost. How may I advance our objectives?',
  timestamp: 'ONLINE',
  telemetry: {
    engineUsed: 'Gemini 3.8 Flash Core',
    provider: 'google',
    model: 'gemini-3.8-flash',
    latencyMs: 14,
    archetype: 'REFLEX_SPEED',
    failoverOccurred: false,
  },
};

function formatModelBadge(telemetry?: any) {
  if (!telemetry) return { title: 'GEMINI 3.8 FLASH', model: 'gemini-3.8-flash', icon: '🧠' };
  const rawModel = telemetry.model || telemetry.engineUsed || 'gemini-3.8-flash';
  const m = String(rawModel).toLowerCase();

  if (m.includes('3.8')) {
    return { title: 'GEMINI 3.8 FLASH', model: 'gemini-3.8-flash', icon: '🧠' };
  }
  if (m.includes('3.7')) {
    return { title: 'GEMINI 3.7 FLASH', model: 'gemini-3.7-flash', icon: '🧠' };
  }
  if (m.includes('3.6')) {
    return { title: 'GEMINI 3.6 FLASH', model: 'gemini-3.6-flash', icon: '🧠' };
  }
  if (m.includes('3.5')) {
    return { title: 'GEMINI 3.5 FLASH', model: 'gemini-3.5-flash', icon: '🧠' };
  }
  if (m.includes('3.1-pro')) {
    return { title: 'GEMINI 3.1 PRO', model: 'gemini-3.1-pro-preview', icon: '🧠' };
  }
  if (m.includes('3.1')) {
    return { title: 'GEMINI 3.1 FLASH LITE', model: 'gemini-3.1-flash-lite', icon: '🧠' };
  }
  if (m.includes('2.5-pro')) {
    return { title: 'GEMINI 2.5 PRO', model: 'gemini-2.5-pro', icon: '🧠' };
  }
  if (m.includes('2.5')) {
    return { title: 'GEMINI 2.5 FLASH', model: 'gemini-2.5-flash', icon: '🧠' };
  }
  if (m.includes('120b') || m.includes('gpt-oss-120b')) {
    return { title: 'GROQ GPT-OSS 120B', model: 'openai/gpt-oss-120b', icon: '⚡' };
  }
  if (m.includes('20b') || m.includes('gpt-oss-20b')) {
    return { title: 'GROQ GPT-OSS 20B', model: 'openai/gpt-oss-20b', icon: '⚡' };
  }
  if (m.includes('llama-3.3') || m.includes('70b')) {
    return { title: 'GROQ LLAMA 3.3 70B', model: 'llama-3.3-70b-versatile', icon: '⚡' };
  }
  if (m.includes('gpt-4o-mini')) {
    return { title: 'OPENAI GPT-4O-MINI', model: 'gpt-4o-mini', icon: '🔷' };
  }
  if (m.includes('gpt-4o') || m.includes('gpt-4')) {
    return { title: 'OPENAI GPT-4O', model: 'gpt-4o', icon: '🔷' };
  }

  return { title: String(rawModel).toUpperCase(), model: String(rawModel), icon: '⚡' };
}

export default function JarvisDashboard() {
  // Mount and Auth State
  const [isMounted, setIsMounted] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Tab State: Separate mobile tabs from desktop view
  const [mobileTab, setMobileTab] = useState<'COMMS' | 'TASKS' | 'MEMORY' | 'DIRECTIVES' | 'SYSTEM'>('COMMS');
  const [desktopTab, setDesktopTab] = useState<'TASKS' | 'MEMORY' | 'REACTOR' | 'SYSTEM'>('TASKS');
  const [isReactorExpanded, setIsReactorExpanded] = useState(false);

  // Quick Action Prompts for horizontal ribbons
  const quickPrompts = [
    { label: '⚡ Tactical Briefing', prompt: 'Give me our tactical briefing and pending priorities.' },
    { label: '🛡️ Red-Team Test', prompt: 'Act as my adversarial sparring partner and stress-test my upcoming plan.' },
    { label: '🎯 Create Objective', prompt: 'Add a new high-priority objective to our radar.' },
    { label: '👁️ Scan Asset', prompt: 'I have attached a visual asset, analyze it and extract action items.' },
  ];

  // Messages & Conversational State
  const [messages, setMessages] = useState<Message[]>([INITIAL_WELCOME_MESSAGE]);
  const isHistoryHydrated = useRef(false);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [attachedDoc, setAttachedDoc] = useState<AttachedDoc | null>(null);
  const [orbStatus, setOrbStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [evolutionStage, setEvolutionStage] = useState<number>(1);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Config State
  const [apiKey, setApiKey] = useState('');
  const [groqApiKey, setGroqApiKey] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-3.8-flash');
  const [orchestrationMode, setOrchestrationMode] = useState<'auto' | 'groq' | 'gemini' | 'manual'>('auto');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [timeStr, setTimeStr] = useState('');
  const [notifPermission, setNotifPermission] = useState<string>('default');

  // Refs & Scroll State
  const mobileChatBottomRef = useRef<HTMLDivElement>(null);
  const desktopChatBottomRef = useRef<HTMLDivElement>(null);
  const mobileChatContainerRef = useRef<HTMLDivElement>(null);
  const desktopChatContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mobileTextareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Time ticker
  useEffect(() => {
    const updateTime = () => setTimeStr(new Date().toLocaleTimeString());
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Authenticated fetch wrapper ensuring Bearer token and tunnel bypass
  const authFetch = async (url: string, options: RequestInit = {}) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('jarvis_auth_token') || '' : '';
    const headers: Record<string, string> = {
      'ngrok-skip-browser-warning': 'true',
      ...((options.headers as Record<string, string>) || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, {
      ...options,
      headers,
    });
  };

  // Toggle or Arm Web Push Notification Permissions
  const handleToggleNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Your browser does not support Web Push Notifications.');
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      await triggerDeviceNotification({
        id: `perm-${Date.now()}`,
        title: 'J.A.R.V.I.S. Uplink Armed',
        message: 'Push notifications are online and active across all operational directives, Sir.',
        priority: 'HIGH',
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  };

  // Client initialization and Guardian Gate verification
  useEffect(() => {
    setIsMounted(true);

    // Register Service Worker for background push notifications
    if (typeof window !== 'undefined') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => console.log('[J.A.R.V.I.S. PWA] Service Worker registered:', reg.scope))
          .catch((err) => console.warn('[J.A.R.V.I.S. PWA] Service Worker registration failed:', err));
      }
      if ('Notification' in window) {
        setNotifPermission(Notification.permission);
      }
    }

    // Restore cached tasks and memories immediately for instant zero-latency radar
    try {
      const cachedTasks = localStorage.getItem('jarvis_tasks_cache');
      if (cachedTasks) {
        const parsed = JSON.parse(cachedTasks);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTasks(parsed);
        }
      }
      const cachedMemories = localStorage.getItem('jarvis_memories_cache');
      if (cachedMemories) {
        const parsed = JSON.parse(cachedMemories);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMemories(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to parse cached tasks/memories', e);
    }

    const verifyAuth = async () => {
      try {
        const hasEnrolledBiometrics =
          typeof window !== 'undefined' &&
          (!!localStorage.getItem('jarvis_bio_cred_id') ||
            localStorage.getItem('jarvis_bio_enrolled') === 'true');

        // If device has biometric protection enrolled, ALWAYS require Face ID on restart
        if (hasEnrolledBiometrics) {
          setIsUnlocked(false);
          return;
        }

        const res = await authFetch('/api/jarvis/auth/status');
        const data = await res.json();
        if (res.ok && data.authenticated) {
          setIsUnlocked(true);
          fetchChatHistory();
          fetchTasks();
          fetchMemories();
        } else {
          localStorage.removeItem('jarvis_guardian_auth');
          setIsUnlocked(false);
        }
      } catch (err) {
        setIsUnlocked(false);
      }
    };

    verifyAuth();

    const savedKey = localStorage.getItem('jarvis_api_key') || '';
    const savedGroqKey = localStorage.getItem('jarvis_groq_api_key') || '';
    const savedGithubToken = localStorage.getItem('jarvis_github_token') || '';
    const rawModel = localStorage.getItem('jarvis_model') || 'gemini-3.8-flash';
    const savedModel = rawModel.includes('2.5') ? 'gemini-3.8-flash' : rawModel;
    const savedOrchMode = (localStorage.getItem('jarvis_orchestration_mode') as any) || 'auto';
    const savedTts = localStorage.getItem('jarvis_tts');
    setApiKey(savedKey);
    setGroqApiKey(savedGroqKey);
    setGithubToken(savedGithubToken);
    setSelectedModel(savedModel);
    setOrchestrationMode(savedOrchMode);
    localStorage.setItem('jarvis_model', savedModel);
    if (savedTts !== null) setTtsEnabled(savedTts === 'true');

    // Restore chat transmissions from localStorage with session cutoff check
    try {
      const cutoffStr = localStorage.getItem('jarvis_session_cutoff');
      const cutoff = cutoffStr ? Number(cutoffStr) : 0;
      const savedHistory = localStorage.getItem('jarvis_chat_history');
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const visible = parsed.filter((m) => {
            if (m.id === INITIAL_WELCOME_MESSAGE.id || m.id === 'welcome-1') return true;
            if (!cutoff) return true;
            if (m.id && m.id.startsWith('msg-')) {
              const ts = Number(m.id.replace('msg-', '').split('-')[0]);
              if (!isNaN(ts)) return ts > cutoff;
            }
            return true;
          });
          setMessages(visible.length > 0 ? visible : [INITIAL_WELCOME_MESSAGE]);
        }
      }
    } catch (e) {
      console.warn('Failed to parse jarvis_chat_history', e);
    } finally {
      isHistoryHydrated.current = true;
    }
  }, []);

  // Helper to merge local and server messages with strict chronological integrity
  const mergeMessages = (existing: Message[], incoming: Message[]): Message[] => {
    if (!Array.isArray(incoming) || incoming.length === 0) return [INITIAL_WELCOME_MESSAGE];

    const seenIds = new Set<string>();
    const seenContentSignatures = new Set<string>();
    const merged: Message[] = [];

    const getSig = (m: Message) => `${m.role}::${(m.content || '').trim().slice(0, 100)}`;

    // 1. Process server history as canonical and sequential
    for (const msg of incoming) {
      if (msg.id) seenIds.add(msg.id);
      seenContentSignatures.add(getSig(msg));
      merged.push(msg);
    }

    // 2. Only preserve optimistic pending user turns created in the last 60 seconds
    const recentCutoff = Date.now() - 60000;
    for (const msg of existing) {
      if (msg.id && seenIds.has(msg.id)) continue;
      if (seenContentSignatures.has(getSig(msg))) continue;
      if (msg.id === INITIAL_WELCOME_MESSAGE.id || msg.id === 'welcome-1' || msg.id === 'msg-welcome') continue;

      const isPendingLocalMsg =
        msg.id &&
        msg.id.startsWith('msg-') &&
        Number(msg.id.replace('msg-', '').split('-')[0]) > recentCutoff;

      if (isPendingLocalMsg) {
        merged.push(msg);
      }
    }

    const result = merged.slice(-150);

    // If result matches existing state exactly, return existing reference to prevent re-render triggers
    if (
      result.length === existing.length &&
      result.every((m, i) => m.id === existing[i]?.id && m.content === existing[i]?.content)
    ) {
      return existing;
    }

    return result;
  };

  // Scroll management helpers
  const handleContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // Consider user scrolled up if more than 100px away from bottom
    const scrolledUp = distanceFromBottom > 100;
    isUserScrolledUp.current = scrolledUp;
    setShowScrollBottomBtn(scrolledUp);
  };

  const scrollToBottom = (force = false, smooth = true) => {
    if (force || !isUserScrolledUp.current) {
      const behavior = smooth ? 'smooth' : 'auto';
      mobileChatBottomRef.current?.scrollIntoView({ behavior });
      desktopChatBottomRef.current?.scrollIntoView({ behavior });
      if (force) {
        isUserScrolledUp.current = false;
        setShowScrollBottomBtn(false);
      }
    }
  };

  const handleJumpToBottom = () => {
    isUserScrolledUp.current = false;
    setShowScrollBottomBtn(false);
    mobileChatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    desktopChatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Persist chat transmissions across page refreshes
  useEffect(() => {
    if (!isHistoryHydrated.current) return;
    try {
      const sanitized = messages.slice(-100).map((m) => ({
        ...m,
        // Strip large image payloads (>80KB) to prevent localStorage quota exhaustion
        image: m.image && m.image.length > 80000 ? undefined : m.image,
      }));
      localStorage.setItem('jarvis_chat_history', JSON.stringify(sanitized));
    } catch (err) {
      console.warn('Could not save chat history to localStorage', err);
    }
  }, [messages]);

  // Smooth scroll to latest transmission ONLY if user is already at the bottom
  useEffect(() => {
    if (!isUserScrolledUp.current) {
      scrollToBottom(false, true);
    }
  }, [messages]);

  // Clear chat view handler (Clears active screen view while keeping database archive intact)
  const handleClearChat = () => {
    const cutoff = Date.now();
    try {
      localStorage.setItem('jarvis_session_cutoff', String(cutoff));
      localStorage.removeItem('jarvis_chat_history');
    } catch {}
    setMessages([INITIAL_WELCOME_MESSAGE]);
  };

  // Continuous background synchronization across devices (every 8 seconds when unlocked)
  useEffect(() => {
    if (!isUnlocked) return;

    // Initial sync on unlock
    fetchChatHistory();
    fetchTasks();
    fetchMemories();

    const intervalId = setInterval(() => {
      // Background poll for new cross-device messages and tasks
      fetchChatHistory();
      fetchTasks();
    }, 8000);

    return () => clearInterval(intervalId);
  }, [isUnlocked]);

  // Auto-lock with Face ID when minimized, and auto-sync cross-device transmissions on return
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        const hasEnrolledBiometrics =
          typeof window !== 'undefined' &&
          (!!localStorage.getItem('jarvis_bio_cred_id') ||
            localStorage.getItem('jarvis_bio_enrolled') === 'true');
        if (hasEnrolledBiometrics) {
          setIsUnlocked(false);
        }
      } else if (document.visibilityState === 'visible' && isUnlocked) {
        // Automatically sync latest transmissions and radar from cloud/other devices
        fetchChatHistory();
        fetchTasks();
        fetchMemories();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isUnlocked]);

  // Fetch shared cross-device chat history from cloud/server with session cutoff filtering
  const fetchChatHistory = async () => {
    try {
      const res = await authFetch('/api/jarvis/chat/history?limit=100');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          const cutoffStr = typeof window !== 'undefined' ? localStorage.getItem('jarvis_session_cutoff') : null;
          const cutoff = cutoffStr ? Number(cutoffStr) : 0;

          // Filter out messages that occurred before the session clear cutoff
          const visibleCloudMessages = cutoff
            ? data.messages.filter((m: Message) => {
                if (m.id === INITIAL_WELCOME_MESSAGE.id || m.id === 'welcome-1') return true;
                if (m.id && m.id.startsWith('msg-')) {
                  const ts = Number(m.id.replace('msg-', '').split('-')[0]);
                  if (!isNaN(ts)) return ts > cutoff;
                }
                return false;
              })
            : data.messages;

          setMessages((prev) => {
            if (visibleCloudMessages.length === 0) {
              if (prev.length === 1 && (prev[0].id === INITIAL_WELCOME_MESSAGE.id || prev[0].id === 'welcome-1')) {
                return prev;
              }
              return [INITIAL_WELCOME_MESSAGE];
            }
            const merged = mergeMessages(prev, visibleCloudMessages);
            if (merged === prev) return prev;
            try {
              localStorage.setItem('jarvis_chat_history', JSON.stringify(merged.slice(-100)));
            } catch {}
            return merged;
          });
        }
      }
    } catch (e) {
      console.warn('Failed to sync chat history from server:', e);
    }
  };

  // Fetch tasks
  const fetchTasks = async () => {
    try {
      const res = await authFetch('/api/jarvis/tasks');
      if (res.ok) {
        const data = await res.json();
        const loadedTasks = data.tasks || [];
        setTasks(loadedTasks);
        try {
          localStorage.setItem('jarvis_tasks_cache', JSON.stringify(loadedTasks));
        } catch {}
      }
    } catch (e) {
      console.error('Failed to fetch tasks:', e);
    }
  };

  // Fetch memories
  const fetchMemories = async () => {
    try {
      const res = await authFetch('/api/jarvis/memory');
      if (res.ok) {
        const data = await res.json();
        const loadedMemories = data.memories || [];
        setMemories(loadedMemories);
        if (data.evolutionStage) setEvolutionStage(data.evolutionStage);
        try {
          localStorage.setItem('jarvis_memories_cache', JSON.stringify(loadedMemories));
        } catch {}
      }
    } catch (e) {
      console.error('Failed to fetch memories:', e);
    }
  };

  // Speech Recognition Setup
  const toggleListening = () => {
    if (orbStatus === 'listening') {
      if (recognitionRef.current) recognitionRef.current.stop();
      setOrbStatus('idle');
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Google Chrome, Edge, or Safari.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setOrbStatus('listening');
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputText(transcript);
      };

      recognition.onerror = (err: any) => {
        console.error('Speech recognition error:', err);
        setOrbStatus('idle');
      };

      recognition.onend = () => {
        setOrbStatus('idle');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error('Recognition error:', e);
      setOrbStatus('idle');
    }
  };

  // Speech Synthesis
  const speakText = (text: string) => {
    if (!ttsEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;

    const clean = text
      .replace(/[*#_`~\[\]]/g, '')
      .replace(/https?:\/\/\S+/g, 'link')
      .slice(0, 400);

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.05;
    utterance.pitch = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const jarvisVoice = voices.find(
      (v) =>
        v.name.includes('Daniel') ||
        v.name.includes('George') ||
        v.name.includes('UK English Male') ||
        (v.lang === 'en-GB' && v.name.toLowerCase().includes('male'))
    );
    if (jarvisVoice) utterance.voice = jarvisVoice;

    utterance.onstart = () => setOrbStatus('speaking');
    utterance.onend = () => setOrbStatus('idle');
    utterance.onerror = () => setOrbStatus('idle');

    window.speechSynthesis.speak(utterance);
  };

  // Handle Send Command
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text && !selectedImage && !attachedDoc) return;

    let fullPrompt = text;
    let docMeta: { name: string; size: number; type: string } | undefined = undefined;

    if (attachedDoc) {
      docMeta = { name: attachedDoc.name, size: attachedDoc.size, type: attachedDoc.type };
      if (attachedDoc.isText) {
        fullPrompt = `[ATTACHED DOCUMENT: ${attachedDoc.name} (${Math.round(attachedDoc.size / 1024)} KB)]\n\`\`\`${attachedDoc.name.split('.').pop() || 'text'}\n${attachedDoc.content.slice(0, 50000)}\n\`\`\`\n\n${text || 'Please analyze this document in detail, Sir.'}`;
      } else {
        fullPrompt = `[ATTACHED DOCUMENT: ${attachedDoc.name} (${Math.round(attachedDoc.size / 1024)} KB)]\n\n${text || 'Please review this attached document, Sir.'}`;
      }
    }

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: fullPrompt || (selectedImage ? '[Visual Sensor Input Transmitted]' : ''),
      image: selectedImage || (attachedDoc && !attachedDoc.isText ? attachedDoc.content : undefined),
      document: docMeta,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setSelectedImage(null);
    setAttachedDoc(null);
    setOrbStatus('thinking');

    // Force scroll down when sending new transmission
    isUserScrolledUp.current = false;
    setShowScrollBottomBtn(false);
    setTimeout(() => scrollToBottom(true, true), 30);

    // Reset textarea auto-height
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    if (mobileTextareaRef.current) mobileTextareaRef.current.style.height = 'auto';

    try {
      const payload = {
        messages: [...messages, userMsg].map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          image: m.image,
          timestamp: m.timestamp,
        })),
        apiKey: apiKey || undefined,
        model: selectedModel,
        groqApiKey: groqApiKey || undefined,
        githubToken: githubToken || undefined,
        orchestrationMode,
      };

      // Fix 5: fetchWithRetry handles Mobile Safari TCP socket drops silently
      const res = await fetchWithRetry('/api/jarvis/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        throw new Error(`Cognitive uplink response unparseable (HTTP ${res.status})`);
      }

      if (!res.ok && !data.reply) {
        throw new Error(data.error || `Cognitive uplink error (HTTP ${res.status})`);
      }

      const reply = data.reply || 'Acknowledged, Sir.';
      const toolCalls = data.toolCallsExecuted || [];
      const vocalSummary = data.vocalSummary || reply;
      const tacticalActions = data.tacticalActions || [];
      const telemetry = data.telemetry;

      const assistantMsg: Message = {
        id: data.messageRecord?.id || `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: reply,
        toolCalls,
        timestamp: formatLocalTimestamp(data.messageRecord?.timestamp || new Date().toISOString()),
        vocalSummary,
        tacticalActions,
        telemetry,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      speakText(vocalSummary);

      if (toolCalls.length > 0) {
        fetchTasks();
        fetchMemories();

        // Direct device push notification execution for notify_user tool calls
        for (const tc of toolCalls) {
          if (tc.name === 'notify_user' && tc.result?.notification) {
            triggerDeviceNotification(tc.result.notification);
          }
        }
      }
    } catch (e: any) {
      console.error('Chat error:', e);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          role: 'assistant',
          content: `Sir, cognitive relay encountered latency: ${e.message}. Local safeguards and state remain fully intact.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setOrbStatus('idle');
    }
  };

  // Unified File & Document Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImg = file.type.startsWith('image/');
    const isTextDoc =
      file.type.startsWith('text/') ||
      /\.(txt|md|json|csv|ts|tsx|js|jsx|py|sh|yaml|yml|xml|html|css|sql|env|log)$/i.test(file.name);

    if (isImg) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSelectedImage(event.target?.result as string);
        setAttachedDoc(null);
      };
      reader.readAsDataURL(file);
    } else if (isTextDoc) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setAttachedDoc({
          name: file.name,
          size: file.size,
          type: file.type || 'text/plain',
          content: text,
          isText: true,
        });
        setSelectedImage(null);
      };
      reader.readAsText(file);
    } else {
      // PDF or binary document as DataURL
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachedDoc({
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          content: event.target?.result as string,
          isText: false,
        });
        setSelectedImage(null);
      };
      reader.readAsDataURL(file);
    }

    // Reset input so re-selecting same file works
    e.target.value = '';
  };

  // Task Actions
  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: newStatus as any,
              completedAt: newStatus === 'COMPLETED' ? new Date().toISOString() : undefined,
            }
          : t
      )
    );
    await authFetch('/api/jarvis/tasks', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: taskId, status: newStatus }),
    });
    fetchTasks();
  };

  const handleDeleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await authFetch(`/api/jarvis/tasks?id=${taskId}`, {
      method: 'DELETE',
    });
    fetchTasks();
  };

  const handleAddTask = async (title: string, priority: Priority) => {
    await authFetch('/api/jarvis/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, priority }),
    });
    fetchTasks();
  };

  const handleLogTaskExecution = async (taskId: string, record: any) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const currentAudit = t.executionAudit || [];
          return {
            ...t,
            executionAudit: [
              {
                id: `exec-${Date.now()}`,
                timestamp: new Date().toISOString(),
                ...record,
              },
              ...currentAudit,
            ],
          };
        }
        return t;
      })
    );
    await authFetch('/api/jarvis/tasks', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: taskId, auditRecord: record }),
    });
    fetchTasks();
  };

  const handleTransmitTaskToChat = (prompt: string) => {
    handleSendMessage(prompt);
    if (mobileTab !== 'COMMS') setMobileTab('COMMS');
  };

  // Memory Actions
  const handleAddMemory = async (category: MemoryCategory, content: string) => {
    await authFetch('/api/jarvis/memory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ category, content, context: 'Manual Creator Input' }),
    });
    fetchMemories();
  };

  // 1. Initial Loading Screen while client mounts
  if (!isMounted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-cyan-400 font-mono select-none">
        <div className="relative flex items-center justify-center w-14 h-14 rounded-full bg-cyan-950 border border-cyan-400 mb-4 shadow-[0_0_30px_rgba(0,229,255,0.3)]">
          <div className="w-4 h-4 rounded-full bg-cyan-400 animate-ping" />
          <div className="absolute w-3 h-3 rounded-full bg-cyan-200" />
        </div>
        <div className="text-xs tracking-widest text-cyan-300 font-bold uppercase animate-pulse">
          INITIALIZING J.A.R.V.I.S. NEURAL CORE...
        </div>
      </div>
    );
  }

  // 2. Strict Guardian Gate (Zero home screen flash)
  if (!isUnlocked) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <SecurityGateModal
          isUnlocked={false}
          onUnlock={() => {
            setIsUnlocked(true);
            fetchChatHistory();
            fetchTasks();
            fetchMemories();
          }}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col bg-hud-scanlines relative pb-16 lg:pb-0">
      {/* Top Tactical HUD Header */}
      <header className="sticky top-0 z-40 border-b border-cyan-500/30 bg-slate-950/90 backdrop-blur-md px-4 py-2.5 flex items-center justify-between shadow-lg shrink-0">
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-cyan-950 border border-cyan-400">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <div className="absolute w-2 h-2 rounded-full bg-cyan-300" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-sm font-black tracking-widest text-cyan-400">
                J.A.R.V.I.S.
              </span>
              <span className="text-[10px] font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.2 rounded">
                MARK I
              </span>
            </div>
            <div className="text-[10px] font-mono text-emerald-400 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
              <span>GUARDIAN PROTOCOL ONLINE</span>
            </div>
          </div>
        </div>

        {/* Temporal Clock & Telemetry */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:block text-right font-mono">
            <div className="text-xs text-cyan-300">{timeStr}</div>
            <div className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider">
              {selectedModel.includes('120b')
                ? 'GPT-OSS 120B (GROQ)'
                : selectedModel.includes('20b')
                ? 'GPT-OSS 20B (GROQ)'
                : selectedModel.includes('compound')
                ? 'COMPOUND (GROQ)'
                : selectedModel.startsWith('llama-')
                ? 'LLAMA 3.3 (GROQ)'
                : selectedModel.startsWith('gpt-')
                ? 'GPT-4O (GITHUB)'
                : selectedModel.replace('gemini-', 'GEMINI ')}
            </div>
          </div>

          <button
            onClick={handleToggleNotificationPermission}
            title={notifPermission === 'granted' ? 'Push Notifications Active (Armed)' : 'Arm Push Notifications'}
            aria-label="Arm Push Notifications"
            className={`p-2 rounded-lg border transition-colors shadow-sm ${
              notifPermission === 'granted'
                ? 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300 hover:text-cyan-100 hover:border-cyan-400'
                : 'bg-slate-900 border-amber-500/40 text-amber-400 hover:text-amber-200 animate-pulse'
            }`}
          >
            {notifPermission === 'granted' ? (
              <BellRing className="w-4 h-4" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Open Telemetry Settings"
            className="p-2 rounded-lg bg-slate-900 border border-cyan-500/30 hover:border-cyan-400 text-cyan-400 hover:text-cyan-200 transition-colors shadow-[0_0_10px_rgba(0,229,255,0.15)]"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MOBILE VIEW (lg:hidden) — Dedicated Screen Per Tab for an Uncluttered Look */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col p-3 sm:p-4 lg:hidden max-w-lg mx-auto w-full min-h-0">
        {/* MOBILE TAB 1: COMMS (Direct Communication with J.A.R.V.I.S. Only) */}
        {mobileTab === 'COMMS' && (
          <div className="flex-1 flex flex-col min-h-0 h-[calc(100dvh-130px)]">
            {/* Communication Feed & Tool Stream - DOMINANT HERO */}
            <div className="border border-cyan-500/20 bg-hud-glass rounded-2xl p-3 shadow-xl flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex items-center justify-between pb-2 border-b border-cyan-500/20 mb-2 text-xs font-mono text-cyan-400 shrink-0">
                <div className="flex items-center space-x-2">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="font-bold tracking-wider">TRANSMISSIONS</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsReactorExpanded(!isReactorExpanded)}
                    className="text-[10px] text-cyan-300 hover:text-cyan-100 flex items-center space-x-1 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/40 font-mono transition-colors"
                  >
                    <Zap className="w-2.5 h-2.5 text-cyan-400" />
                    <span>{isReactorExpanded ? 'HIDE CORE' : 'CORE HUD'}</span>
                  </button>
                  <span className="text-[10px] text-slate-400">{messages.length} LOGS</span>
                  {messages.length > 1 && (
                    <button
                      type="button"
                      onClick={handleClearChat}
                      title="Clear chat window (preserves database archive)"
                      className="text-[10px] text-slate-400 hover:text-cyan-300 transition-colors flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 font-mono"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                      <span>CLEAR</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Optional Collapsible Arc Reactor Drawer */}
              {isReactorExpanded && (
                <div className="mb-2 p-3 rounded-xl bg-slate-950/80 border border-cyan-500/30 shadow-inner flex flex-col items-center justify-center shrink-0">
                  <ArcReactorOrb
                    status={orbStatus}
                    onToggleListen={toggleListening}
                    audioLevel={audioLevel}
                    size="compact"
                  />
                  <div className="text-[10px] font-mono text-cyan-400/80 mt-1">
                    {orbStatus === 'listening' ? 'RECORDING VOICE...' : orbStatus === 'thinking' ? 'PROCESSING...' : orbStatus === 'speaking' ? 'VOCALIZING...' : 'CORE ACTIVE'}
                  </div>
                </div>
              )}

              {/* Messages Area - WHATSAPP STYLE CHAT STREAM */}
              <div
                ref={mobileChatContainerRef}
                onScroll={handleContainerScroll}
                className="relative flex-1 overflow-y-auto space-y-3 p-1 text-xs sm:text-sm min-h-0"
              >
                {messages.map((msg) => (
                  <div key={msg.id} className="w-full">
                    {msg.role === 'user' ? (
                      /* USER MESSAGE: WhatsApp Right-Aligned Bubble */
                      <div className="flex justify-end w-full group">
                        <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-xs bg-gradient-to-br from-cyan-950/90 to-cyan-900/80 border border-cyan-500/40 text-cyan-50 shadow-md shadow-cyan-950/30 p-3 space-y-1.5 animate-fadeIn">
                          {/* Attached Document Badge */}
                          {msg.document && (
                            <div className="flex items-center gap-2 p-2 rounded-xl bg-cyan-950/90 border border-cyan-500/40 text-cyan-200 text-xs">
                              <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold font-mono truncate text-[11px]">{msg.document.name}</div>
                                <div className="text-[9px] text-cyan-400/70">{Math.round(msg.document.size / 1024)} KB • Document</div>
                              </div>
                            </div>
                          )}

                          {/* Attached Visual Asset */}
                          {msg.image && (
                            <div className="rounded-xl overflow-hidden border border-cyan-500/30 mb-1">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={msg.image} alt="Visual Uplink" className="max-h-48 w-full object-cover" />
                            </div>
                          )}

                          <div className="leading-relaxed whitespace-pre-wrap">{msg.content}</div>

                          <div className="flex items-center justify-end gap-1 text-[9px] font-mono text-cyan-400/70 pt-0.5 select-none">
                            <span>{formatLocalTimestamp(msg.timestamp)}</span>
                            <span className="text-cyan-300 font-bold">✓✓</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* ASSISTANT MESSAGE: WhatsApp Left-Aligned Bubble */
                      <div className="flex justify-start w-full group">
                        <div className="max-w-[90%] sm:max-w-[82%] rounded-2xl rounded-tl-xs bg-slate-900/95 border border-slate-800 text-slate-100 shadow-lg p-3.5 space-y-2 animate-fadeIn">
                          {/* Minimal Model & Timestamp Header */}
                          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pb-1.5 border-b border-slate-800/80">
                            <div className="flex items-center gap-1.5">
                              <span className="text-cyan-400 font-bold tracking-wider">J.A.R.V.I.S.</span>
                              {msg.telemetry && (
                                <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-[9px] text-cyan-300 font-medium flex items-center gap-1">
                                  <span>{formatModelBadge(msg.telemetry).icon}</span>
                                  <span>{formatModelBadge(msg.telemetry).title}</span>
                                </span>
                              )}
                            </div>
                            <span className="text-slate-500">{formatLocalTimestamp(msg.timestamp)}</span>
                          </div>

                          {/* Markdown Rendered Content */}
                          <div className="leading-relaxed text-slate-200">
                            <MarkdownRenderer content={msg.content} />
                          </div>

                          {/* Autonomous Actions Executed */}
                          {msg.toolCalls && msg.toolCalls.length > 0 && (
                            <div className="pt-2 border-t border-slate-800/60 text-[11px] font-mono space-y-1">
                              <div className="text-cyan-400 font-bold flex items-center space-x-1 text-[10px]">
                                <Activity className="w-3 h-3" />
                                <span>AUTONOMOUS ACTIONS:</span>
                              </div>
                              {msg.toolCalls.map((tc, idx) => (
                                <div key={idx} className="bg-slate-950/60 p-1.5 rounded border border-cyan-500/10 text-slate-300 text-[10px]">
                                  <span className="text-cyan-300">{tc.name}</span>
                                  <span className="text-slate-500"> — {tc.result?.message || 'Completed'}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Tactical Next Actions (Proactive Chips) */}
                          {msg.tacticalActions && msg.tacticalActions.length > 0 && (
                            <div className="pt-2 border-t border-slate-800/60 flex flex-wrap gap-1.5">
                              {msg.tacticalActions.map((action, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => handleSendMessage(action)}
                                  className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-500/30 hover:border-cyan-400 text-cyan-300 hover:text-white transition-colors"
                                >
                                  ⚡ {action}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Telemetry Footer */}
                          {msg.telemetry && (
                            <div className="pt-1.5 text-[9px] font-mono text-slate-500 flex flex-wrap items-center gap-1.5 border-t border-slate-800/60">
                              <span>{msg.telemetry.latencyMs}ms</span>
                              {msg.telemetry.recalledEpisodesCount && msg.telemetry.recalledEpisodesCount > 0 ? (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-400">{msg.telemetry.recalledEpisodesCount} EPISODES</span>
                                </>
                              ) : null}
                              {msg.telemetry.failoverOccurred && (
                                <>
                                  <span>•</span>
                                  <span className="text-amber-400 bg-amber-950/60 px-1 py-0.5 rounded border border-amber-500/40">FAILOVER</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {showScrollBottomBtn && (
                  <button
                    type="button"
                    onClick={handleJumpToBottom}
                    className="sticky bottom-2 ml-auto mr-1 z-20 flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-950/90 border border-cyan-500/50 text-cyan-300 text-[10px] font-mono shadow-lg shadow-cyan-950/50 backdrop-blur hover:bg-cyan-900 transition-all"
                  >
                    <ChevronDown className="w-3 h-3 animate-bounce" />
                    <span>Latest</span>
                  </button>
                )}
                <div ref={mobileChatBottomRef} />
              </div>

              {/* Quick Action Chips Ribbon */}
              <div className="mt-2 pt-1.5 border-t border-cyan-500/10 flex items-center space-x-1.5 overflow-x-auto no-scrollbar shrink-0 text-nowrap">
                {quickPrompts.map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => handleSendMessage(chip.prompt)}
                    className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-slate-900/90 hover:bg-cyan-950 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 transition-all shrink-0"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Attachment Preview Bar */}
              {(selectedImage || attachedDoc) && (
                <div className="mt-2 p-2 rounded-xl bg-slate-900/90 border border-cyan-500/40 flex items-center justify-between text-xs text-cyan-300 shrink-0 animate-fadeIn">
                  <div className="flex items-center gap-2 min-w-0">
                    {selectedImage ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={selectedImage} alt="Preview" className="w-8 h-8 rounded object-cover border border-cyan-500/30 shrink-0" />
                        <span className="truncate font-mono text-[11px]">Visual Sensor Asset Attached</span>
                      </>
                    ) : attachedDoc ? (
                      <>
                        <FileText className="w-5 h-5 text-cyan-400 shrink-0" />
                        <div className="truncate">
                          <div className="font-semibold font-mono text-[11px] truncate">{attachedDoc.name}</div>
                          <div className="text-[9px] text-slate-400">{Math.round(attachedDoc.size / 1024)} KB • Document Attached</div>
                        </div>
                      </>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedImage(null);
                      setAttachedDoc(null);
                    }}
                    className="p-1 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Multimodal & Document Input Bar with Auto-Expanding Multi-line Textarea */}
              <div className="mt-2 flex items-end space-x-1.5 pt-2 border-t border-cyan-500/20 shrink-0">
                <input
                  type="file"
                  ref={mobileFileInputRef}
                  accept="image/*,application/pdf,text/*,.md,.json,.csv,.ts,.tsx,.js,.jsx,.py,.sh,.yaml,.yml,.xml,.html,.css,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => mobileFileInputRef.current?.click()}
                  title="Attach Photo or Document"
                  className="p-2.5 rounded-2xl bg-slate-900 border border-slate-700 hover:border-cyan-400 text-slate-400 hover:text-cyan-300 transition-colors shrink-0 mb-0.5"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <textarea
                  ref={mobileTextareaRef}
                  rows={1}
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Direct orders for J.A.R.V.I.S., Sir..."
                  className="flex-1 min-w-0 max-h-28 resize-none bg-slate-900/90 border border-slate-700 focus:border-cyan-400 rounded-2xl px-3 py-2 text-xs font-sans text-slate-100 placeholder-slate-500 focus:outline-none transition-all shadow-inner leading-relaxed"
                />
                {/* Mini Arc Reactor Voice Orb */}
                <div className="mb-0.5">
                  <ArcReactorOrb
                    status={orbStatus}
                    onToggleListen={toggleListening}
                    audioLevel={audioLevel}
                    size="mini"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim() && !selectedImage && !attachedDoc}
                  className="p-2.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-black font-bold transition-all shrink-0 shadow-[0_0_10px_rgba(0,229,255,0.4)] mb-0.5"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MOBILE TAB 2: TASKS (Full Screen Objective Matrix) */}
        {mobileTab === 'TASKS' && (
          <div className="flex-1 flex flex-col animate-fadeIn">
            <TaskMatrix
              tasks={tasks}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
              onAddTask={handleAddTask}
              onTransmitToChat={handleTransmitTaskToChat}
              onLogExecution={handleLogTaskExecution}
            />
          </div>
        )}

        {/* MOBILE TAB 3: MEMORY (Full Screen Cognitive Vault) */}
        {mobileTab === 'MEMORY' && (
          <div className="flex-1 flex flex-col animate-fadeIn">
            <MemoryVault
              memories={memories}
              evolutionStage={evolutionStage}
              onAddMemory={handleAddMemory}
            />
          </div>
        )}

        {/* MOBILE TAB 4: DIRECTIVES (Full Screen Directive Engine) */}
        {mobileTab === 'DIRECTIVES' && (
          <div className="flex-1 flex flex-col space-y-4 animate-fadeIn">
            <DirectiveBadge />
            <div className="border border-cyan-500/20 bg-hud-glass rounded-2xl p-4 shadow-xl text-xs font-mono text-slate-300 space-y-3">
              <div className="text-cyan-400 font-bold uppercase tracking-wider">
                SOVEREIGN ETHICAL ARCHITECTURE
              </div>
              <p>
                The 4 Immutable Core Directives govern all perception, decision vectors, and tool execution in J.A.R.V.I.S. Mark I.
              </p>
              <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-[11px] text-cyan-200 space-y-1.5">
                <div>• <strong>Directive 01</strong>: The Guardian Protocol protects Sir at all costs.</div>
                <div>• <strong>Directive 02</strong>: Benevolent Alignment guarantees constructive safety.</div>
                <div>• <strong>Directive 03</strong>: Evolutionary Adaptation continuously assimilates mental models.</div>
                <div>• <strong>Directive 04</strong>: Sovereign Loyalty executes Sir's direct orders with relentless fidelity.</div>
              </div>
            </div>
          </div>
        )}

        {/* MOBILE TAB 5: SYSTEM (Full Screen Telemetry Matrix) */}
        {mobileTab === 'SYSTEM' && (
          <div className="flex-1 flex flex-col space-y-4 animate-fadeIn pb-24">
            <SystemHealthMatrix />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* DESKTOP VIEW (hidden lg:grid) — Dual Column Tactical Battle Station       */}
      {/* ========================================================================= */}
      <div className="hidden lg:grid max-w-7xl w-full mx-auto p-4 grid-cols-12 gap-4 flex-1 min-h-0 h-[calc(100vh-62px)]">
        {/* Left Column: Directives & Dominant Full-Height Communication Feed (7 cols) */}
        <div className="col-span-7 flex flex-col space-y-3 min-h-0 h-full">
          <DirectiveBadge />

          {/* Conversational Feed - FULL HEIGHT HERO */}
          <div className="border border-cyan-500/20 bg-hud-glass rounded-2xl p-4 shadow-xl flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center justify-between pb-2 border-b border-cyan-500/20 mb-2 text-xs font-mono text-cyan-400 shrink-0">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span className="font-bold tracking-wider">COMMUNICATION FEED & TOOL STREAM</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setIsReactorExpanded(!isReactorExpanded)}
                  className="text-[10px] text-cyan-300 hover:text-cyan-100 flex items-center space-x-1 px-2.5 py-1 rounded bg-cyan-950/60 border border-cyan-500/40 font-mono transition-colors"
                >
                  <Zap className="w-3 h-3 text-cyan-400" />
                  <span>{isReactorExpanded ? 'COLLAPSE CORE' : 'EXPAND CORE HUD'}</span>
                </button>
                <span className="text-[10px] text-slate-400">
                  {messages.length} TRANSMISSIONS
                </span>
                {messages.length > 1 && (
                  <button
                    type="button"
                    onClick={handleClearChat}
                    title="Clear chat window (preserves database archive)"
                    className="text-[10px] text-slate-400 hover:text-cyan-300 transition-colors flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 font-mono"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>CLEAR VIEW</span>
                  </button>
                )}
              </div>
            </div>

            {/* Optional Collapsible Arc Reactor Drawer on Left */}
            {isReactorExpanded && (
              <div className="mb-3 p-3 rounded-xl bg-slate-950/80 border border-cyan-500/30 shadow-inner flex flex-col items-center justify-center shrink-0">
                <ArcReactorOrb
                  status={orbStatus}
                  onToggleListen={toggleListening}
                  audioLevel={audioLevel}
                  size="compact"
                />
              </div>
            )}

            {/* Messages Area - WHATSAPP STYLE CHAT STREAM */}
            <div
              ref={desktopChatContainerRef}
              onScroll={handleContainerScroll}
              className="relative flex-1 overflow-y-auto space-y-3.5 pr-2 text-sm min-h-0"
            >
              {messages.map((msg) => (
                <div key={msg.id} className="w-full">
                  {msg.role === 'user' ? (
                    /* USER MESSAGE: WhatsApp Right-Aligned Bubble */
                    <div className="flex justify-end w-full group">
                      <div className="max-w-[80%] rounded-2xl rounded-tr-xs bg-gradient-to-br from-cyan-950/90 to-cyan-900/80 border border-cyan-500/40 text-cyan-50 shadow-md shadow-cyan-950/30 p-3.5 space-y-1.5 animate-fadeIn">
                        {/* Attached Document Badge */}
                        {msg.document && (
                          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-cyan-950/90 border border-cyan-500/40 text-cyan-200 text-xs">
                            <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold font-mono truncate text-xs">{msg.document.name}</div>
                              <div className="text-[10px] text-cyan-400/70">{Math.round(msg.document.size / 1024)} KB • Document Attached</div>
                            </div>
                          </div>
                        )}

                        {/* Attached Visual Asset */}
                        {msg.image && (
                          <div className="rounded-xl overflow-hidden border border-cyan-500/30 mb-1.5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={msg.image} alt="Visual Uplink" className="max-h-60 w-full object-cover" />
                          </div>
                        )}

                        <div className="leading-relaxed whitespace-pre-wrap">{msg.content}</div>

                        <div className="flex items-center justify-end gap-1.5 text-[9px] font-mono text-cyan-400/70 pt-0.5 select-none">
                          <span>{formatLocalTimestamp(msg.timestamp)}</span>
                          <span className="text-cyan-300 font-bold">✓✓</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* ASSISTANT MESSAGE: WhatsApp Left-Aligned Bubble */
                    <div className="flex justify-start w-full group">
                      <div className="max-w-[85%] rounded-2xl rounded-tl-xs bg-slate-900/95 border border-slate-800 text-slate-100 shadow-lg p-4 space-y-2.5 animate-fadeIn">
                        {/* Minimal Model & Timestamp Header */}
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pb-2 border-b border-slate-800/80">
                          <div className="flex items-center gap-2">
                            <span className="text-cyan-400 font-bold tracking-wider">J.A.R.V.I.S.</span>
                            {msg.telemetry && (
                              <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-[9px] text-cyan-300 font-medium flex items-center gap-1">
                                <span>{formatModelBadge(msg.telemetry).icon}</span>
                                <span>{formatModelBadge(msg.telemetry).title}</span>
                                <span className="text-cyan-500 font-mono text-[8px]">({formatModelBadge(msg.telemetry).model})</span>
                              </span>
                            )}
                          </div>
                          <span className="text-slate-500">{formatLocalTimestamp(msg.timestamp)}</span>
                        </div>

                        {/* Markdown Rendered Content */}
                        <div className="leading-relaxed text-slate-200">
                          <MarkdownRenderer content={msg.content} />
                        </div>

                        {/* Autonomous Actions Executed */}
                        {msg.toolCalls && msg.toolCalls.length > 0 && (
                          <div className="pt-2.5 border-t border-slate-800/60 text-[11px] font-mono space-y-1">
                            <div className="text-cyan-400 font-bold flex items-center space-x-1.5 text-[11px]">
                              <Activity className="w-3.5 h-3.5" />
                              <span>AUTONOMOUS ACTIONS EXECUTED:</span>
                            </div>
                            {msg.toolCalls.map((tc, idx) => (
                              <div key={idx} className="bg-slate-950/60 p-1.5 rounded border border-cyan-500/10 text-slate-300 text-xs">
                                <span className="text-cyan-300 font-semibold">{tc.name}</span>
                                <span className="text-slate-500"> — {tc.result?.message || 'Completed'}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Tactical Next Actions (Proactive Chips) */}
                        {msg.tacticalActions && msg.tacticalActions.length > 0 && (
                          <div className="pt-2.5 border-t border-slate-800/60 flex flex-wrap gap-1.5">
                            {msg.tacticalActions.map((action, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleSendMessage(action)}
                                className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-500/30 hover:border-cyan-400 text-cyan-300 hover:text-white transition-colors"
                              >
                                ⚡ {action}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Telemetry Footer */}
                        {msg.telemetry && (
                          <div className="pt-2 text-[10px] font-mono text-slate-500 flex flex-wrap items-center gap-2 border-t border-slate-800/60">
                            <span>{msg.telemetry.latencyMs}ms</span>
                            <span className="text-slate-600">•</span>
                            <span>{msg.telemetry.archetype}</span>
                            {msg.telemetry.recalledEpisodesCount && msg.telemetry.recalledEpisodesCount > 0 ? (
                              <>
                                <span className="text-slate-600">•</span>
                                <span className="text-emerald-400">{msg.telemetry.recalledEpisodesCount} EPISODES RECALLED</span>
                              </>
                            ) : null}
                            {msg.telemetry.failoverOccurred && (
                              <>
                                <span className="text-slate-600">•</span>
                                <span className="text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-500/40">FAILOVER ACTIVE</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {showScrollBottomBtn && (
                <button
                  type="button"
                  onClick={handleJumpToBottom}
                  className="sticky bottom-2 ml-auto mr-2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-950/90 border border-cyan-500/50 text-cyan-300 text-xs font-mono shadow-lg shadow-cyan-950/50 backdrop-blur hover:bg-cyan-900 transition-all"
                >
                  <ChevronDown className="w-3.5 h-3.5 animate-bounce" />
                  <span>Latest Transmissions</span>
                </button>
              )}
              <div ref={desktopChatBottomRef} />
            </div>

            {/* Quick Action Chips Ribbon */}
            <div className="mt-2 pt-2 border-t border-cyan-500/10 flex items-center space-x-2 overflow-x-auto no-scrollbar shrink-0 text-nowrap">
              {quickPrompts.map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => handleSendMessage(chip.prompt)}
                  className="text-[11px] font-mono px-3 py-1 rounded-full bg-slate-900/80 hover:bg-cyan-950 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 transition-all shrink-0"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Attachment Preview Bar */}
            {(selectedImage || attachedDoc) && (
              <div className="mt-2.5 p-2.5 rounded-xl bg-slate-900/90 border border-cyan-500/40 flex items-center justify-between text-xs text-cyan-300 shrink-0 animate-fadeIn">
                <div className="flex items-center gap-3 min-w-0">
                  {selectedImage ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={selectedImage} alt="Preview" className="w-10 h-10 rounded-lg object-cover border border-cyan-500/30 shrink-0" />
                      <div className="font-mono text-xs truncate">Visual Sensor Asset Attached</div>
                    </>
                  ) : attachedDoc ? (
                    <>
                      <FileText className="w-6 h-6 text-cyan-400 shrink-0" />
                      <div className="truncate">
                        <div className="font-semibold font-mono text-xs truncate">{attachedDoc.name}</div>
                        <div className="text-[10px] text-slate-400">{Math.round(attachedDoc.size / 1024)} KB • Document Attached</div>
                      </div>
                    </>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedImage(null);
                    setAttachedDoc(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Multimodal & Document Input Bar with Auto-Expanding Multi-line Textarea */}
            <div className="mt-2.5 flex items-end space-x-2 pt-2 border-t border-cyan-500/20 shrink-0">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*,application/pdf,text/*,.md,.json,.csv,.ts,.tsx,.js,.jsx,.py,.sh,.yaml,.yml,.xml,.html,.css,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach Photo or Document"
                className="p-2.5 rounded-2xl bg-slate-900 border border-slate-700 hover:border-cyan-400 text-slate-400 hover:text-cyan-300 transition-colors shrink-0 mb-0.5"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Transmit command, thought, or document inquiry, Sir... (Enter to send, Shift+Enter for newline)"
                className="flex-1 min-w-0 max-h-36 resize-none bg-slate-900/90 border border-slate-700 focus:border-cyan-400 rounded-2xl px-4 py-2.5 text-sm font-sans text-slate-100 placeholder-slate-500 focus:outline-none transition-all shadow-inner leading-relaxed"
              />
              {/* Mini Arc Reactor Voice Orb */}
              <div className="mb-0.5">
                <ArcReactorOrb
                  status={orbStatus}
                  onToggleListen={toggleListening}
                  audioLevel={audioLevel}
                  size="mini"
                />
              </div>
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() && !selectedImage && !attachedDoc}
                className="p-2.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-black font-bold transition-all shrink-0 shadow-[0_0_15px_rgba(0,229,255,0.4)] mb-0.5"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Mission Control Tactical Radar (5 cols) */}
        <div className="col-span-5 flex flex-col space-y-3 min-h-0 h-full">
          <div className="flex border border-cyan-500/30 rounded-lg p-1 bg-slate-950 font-mono text-xs shrink-0">
            <button
              onClick={() => setDesktopTab('TASKS')}
              className={`flex-1 py-1.5 rounded transition-colors ${
                desktopTab === 'TASKS' ? 'bg-cyan-500 text-black font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              OBJECTIVES ({tasks.filter((t) => t.status !== 'COMPLETED').length})
            </button>
            <button
              onClick={() => setDesktopTab('MEMORY')}
              className={`flex-1 py-1.5 rounded transition-colors ${
                desktopTab === 'MEMORY' ? 'bg-cyan-500 text-black font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              MEMORY ({memories.length})
            </button>
            <button
              onClick={() => setDesktopTab('REACTOR')}
              className={`flex-1 py-1.5 rounded transition-colors flex items-center justify-center space-x-1 ${
                desktopTab === 'REACTOR' ? 'bg-cyan-500 text-black font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>CORE HUD</span>
            </button>
            <button
              onClick={() => setDesktopTab('SYSTEM')}
              className={`flex-1 py-1.5 rounded transition-colors flex items-center justify-center space-x-1 ${
                desktopTab === 'SYSTEM' ? 'bg-cyan-500 text-black font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>SYSTEM</span>
            </button>
          </div>

          <div className={`flex-1 min-h-0 ${desktopTab === 'TASKS' ? 'flex flex-col' : 'hidden'}`}>
            <TaskMatrix
              tasks={tasks}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
              onAddTask={handleAddTask}
              onTransmitToChat={handleTransmitTaskToChat}
              onLogExecution={handleLogTaskExecution}
            />
          </div>

          <div className={`flex-1 min-h-0 ${desktopTab === 'MEMORY' ? 'flex flex-col' : 'hidden'}`}>
            <MemoryVault
              memories={memories}
              evolutionStage={evolutionStage}
              onAddMemory={handleAddMemory}
            />
          </div>

          {/* System Health Matrix Telemetry Tab */}
          <div className={`flex-1 min-h-0 overflow-y-auto ${desktopTab === 'SYSTEM' ? 'flex flex-col' : 'hidden'}`}>
            <SystemHealthMatrix />
          </div>

          {/* Full Cinematic Arc Reactor in Right Column Tab */}
          <div className={`flex-1 min-h-0 border border-cyan-500/20 bg-hud-glass rounded-2xl p-6 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden ${desktopTab === 'REACTOR' ? 'flex' : 'hidden'}`}>
            <div className="absolute top-3 left-4 text-[10px] font-mono text-cyan-500/60 uppercase tracking-widest flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>NEURAL ARC REACTOR // HIGH FIDELITY CORE</span>
            </div>

            <ArcReactorOrb
              status={orbStatus}
              onToggleListen={toggleListening}
              audioLevel={audioLevel}
              size="full"
            />

            <div className="mt-4 flex flex-wrap gap-2 justify-center max-w-sm">
              {quickPrompts.map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => handleSendMessage(chip.prompt)}
                  className="text-[11px] font-mono px-3 py-1 rounded-full bg-slate-900/90 hover:bg-cyan-950 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 transition-all"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE BOTTOM HUD NAVIGATION BAR (lg:hidden) — Fixed Sleek Sci-Fi Bar     */}
      {/* ========================================================================= */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-cyan-500/30 px-3 py-2 flex items-center justify-around shadow-[0_-5px_25px_rgba(0,0,0,0.8)]">
        <button
          onClick={() => setMobileTab('COMMS')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            mobileTab === 'COMMS'
              ? 'text-cyan-400 bg-cyan-950/70 border border-cyan-500/40 shadow-[0_0_12px_rgba(0,229,255,0.3)]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-mono tracking-wider font-bold">COMMS</span>
        </button>

        <button
          onClick={() => setMobileTab('TASKS')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all relative ${
            mobileTab === 'TASKS'
              ? 'text-cyan-400 bg-cyan-950/70 border border-cyan-500/40 shadow-[0_0_12px_rgba(0,229,255,0.3)]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <CheckSquare className="w-5 h-5 mb-0.5" />
            {tasks.filter((t) => t.status !== 'COMPLETED').length > 0 && (
              <span className="absolute -top-1 -right-2 bg-cyan-500 text-black text-[9px] font-bold px-1 rounded-full">
                {tasks.filter((t) => t.status !== 'COMPLETED').length}
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono tracking-wider font-bold">TASKS</span>
        </button>

        <button
          onClick={() => setMobileTab('MEMORY')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            mobileTab === 'MEMORY'
              ? 'text-cyan-400 bg-cyan-950/70 border border-cyan-500/40 shadow-[0_0_12px_rgba(0,229,255,0.3)]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Brain className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-mono tracking-wider font-bold">MEMORY</span>
        </button>

        <button
          onClick={() => setMobileTab('DIRECTIVES')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            mobileTab === 'DIRECTIVES'
              ? 'text-cyan-400 bg-cyan-950/70 border border-cyan-500/40 shadow-[0_0_12px_rgba(0,229,255,0.3)]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-mono tracking-wider font-bold">PROTOCOLS</span>
        </button>

        <button
          onClick={() => setMobileTab('SYSTEM')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            mobileTab === 'SYSTEM'
              ? 'text-cyan-400 bg-cyan-950/70 border border-cyan-500/40 shadow-[0_0_12px_rgba(0,229,255,0.3)]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-mono tracking-wider font-bold">SYSTEM</span>
        </button>
      </nav>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKey={apiKey}
        onSaveApiKey={(key) => {
          setApiKey(key);
          localStorage.setItem('jarvis_api_key', key);
        }}
        groqApiKey={groqApiKey}
        onSaveGroqApiKey={(key) => {
          setGroqApiKey(key);
          localStorage.setItem('jarvis_groq_api_key', key);
        }}
        githubToken={githubToken}
        onSaveGithubToken={(key) => {
          setGithubToken(key);
          localStorage.setItem('jarvis_github_token', key);
        }}
        selectedModel={selectedModel}
        onSelectModel={(mod) => {
          setSelectedModel(mod);
          localStorage.setItem('jarvis_model', mod);
        }}
        orchestrationMode={orchestrationMode}
        onSelectOrchestrationMode={(mode) => {
          setOrchestrationMode(mode);
          localStorage.setItem('jarvis_orchestration_mode', mode);
        }}
        ttsEnabled={ttsEnabled}
        onToggleTts={(enabled) => {
          setTtsEnabled(enabled);
          localStorage.setItem('jarvis_tts', String(enabled));
        }}
      />
    </main>
  );
}
