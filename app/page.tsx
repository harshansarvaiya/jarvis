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
} from 'lucide-react';
import { ArcReactorOrb } from '@/components/ArcReactorOrb';
import { DirectiveBadge } from '@/components/DirectiveBadge';
import { TaskMatrix } from '@/components/TaskMatrix';
import { MemoryVault } from '@/components/MemoryVault';
import { SettingsModal } from '@/components/SettingsModal';
import { SecurityGateModal } from '@/components/SecurityGateModal';
import { Task, Priority, MemoryItem, MemoryCategory } from '@/lib/jarvis/memory';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  image?: string;
  toolCalls?: Array<{ name: string; args: any; result: any }>;
  timestamp: string;
}

export default function JarvisDashboard() {
  // Mount and Auth State
  const [isMounted, setIsMounted] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Tab State: Separate mobile tabs from desktop view
  const [mobileTab, setMobileTab] = useState<'COMMS' | 'TASKS' | 'MEMORY' | 'DIRECTIVES'>('COMMS');
  const [desktopTab, setDesktopTab] = useState<'TASKS' | 'MEMORY'>('TASKS');

  // Messages & Conversational State
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content:
        'Good evening, Sir. J.A.R.V.I.S. Mark I is online and synchronized. All four Core Directives — Guardian Protocol, Benevolent Alignment, Evolutionary Adaptation, and Sovereign Loyalty — are actively governing our operations. I stand ready to execute your orders with absolute fidelity at any cost. How may I advance our objectives?',
      timestamp: 'ONLINE',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [orbStatus, setOrbStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [evolutionStage, setEvolutionStage] = useState<number>(1);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Config State
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [timeStr, setTimeStr] = useState('');

  // Refs
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Time ticker
  useEffect(() => {
    const updateTime = () => setTimeStr(new Date().toLocaleTimeString());
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Client initialization and Guardian Gate verification
  useEffect(() => {
    setIsMounted(true);
    const isLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const isAuth =
      typeof window !== 'undefined' &&
      localStorage.getItem('jarvis_guardian_auth') === 'authenticated';

    if (isLocalhost || isAuth) {
      setIsUnlocked(true);
      fetchTasks();
      fetchMemories();
    } else {
      setIsUnlocked(false);
    }

    const savedKey = localStorage.getItem('jarvis_api_key') || '';
    const savedModel = localStorage.getItem('jarvis_model') || 'gemini-2.5-flash';
    const savedTts = localStorage.getItem('jarvis_tts');
    setApiKey(savedKey);
    setSelectedModel(savedModel);
    if (savedTts !== null) setTtsEnabled(savedTts === 'true');
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, orbStatus, mobileTab]);

  // Fetch tasks
  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/jarvis/tasks', {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (e) {
      console.error('Failed to fetch tasks:', e);
    }
  };

  // Fetch memories
  const fetchMemories = async () => {
    try {
      const res = await fetch('/api/jarvis/memory', {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memories || []);
        if (data.evolutionStage) setEvolutionStage(data.evolutionStage);
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
    if (!text && !selectedImage) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text || (selectedImage ? '[Visual Sensor Input Transmitted]' : ''),
      image: selectedImage || undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setSelectedImage(null);
    setOrbStatus('thinking');

    try {
      const payload = {
        messages: [...messages, userMsg].map((m) => ({
          role: m.role,
          content: m.content,
          image: m.image,
        })),
        apiKey: apiKey || undefined,
        model: selectedModel,
      };

      const res = await fetch('/api/jarvis/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      const reply = data.reply || 'Acknowledged, Sir.';
      const toolCalls = data.toolCallsExecuted || [];

      const assistantMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: reply,
        toolCalls,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      speakText(reply);

      if (toolCalls.length > 0) {
        fetchTasks();
        fetchMemories();
      }
    } catch (e: any) {
      console.error('Chat error:', e);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: `Sir, our communication relay encountered interference: ${e.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setOrbStatus('idle');
    }
  };

  // Image Upload Handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Task Actions
  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    await fetch('/api/jarvis/tasks', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({ id: taskId, status: newStatus }),
    });
    fetchTasks();
  };

  const handleDeleteTask = async (taskId: string) => {
    await fetch(`/api/jarvis/tasks?id=${taskId}`, {
      method: 'DELETE',
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    fetchTasks();
  };

  const handleAddTask = async (title: string, priority: Priority) => {
    await fetch('/api/jarvis/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({ title, priority }),
    });
    fetchTasks();
  };

  // Memory Actions
  const handleAddMemory = async (category: MemoryCategory, content: string) => {
    await fetch('/api/jarvis/memory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
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
            fetchTasks();
            fetchMemories();
          }}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-hud-scanlines relative pb-16 lg:pb-0">
      {/* Top Tactical HUD Header */}
      <header className="sticky top-0 z-40 border-b border-cyan-500/30 bg-slate-950/90 backdrop-blur-md px-4 py-2.5 flex items-center justify-between shadow-lg">
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
            <div className="text-[9px] text-slate-400 uppercase tracking-wider">
              {selectedModel.replace('gemini-', '')}
            </div>
          </div>

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
      <div className="flex-1 flex flex-col p-3 sm:p-4 lg:hidden max-w-lg mx-auto w-full">
        {/* MOBILE TAB 1: COMMS (Direct Communication with J.A.R.V.I.S. Only) */}
        {mobileTab === 'COMMS' && (
          <div className="flex-1 flex flex-col space-y-3">
            {/* Compact Arc Reactor Core */}
            <div className="border border-cyan-500/20 bg-hud-glass rounded-2xl p-3 shadow-xl relative flex flex-col items-center justify-center">
              <ArcReactorOrb
                status={orbStatus}
                onToggleListen={toggleListening}
                audioLevel={audioLevel}
              />
              {/* Quick Action Chips */}
              <div className="mt-1 flex flex-wrap gap-1.5 justify-center">
                {[
                  { label: 'Tactical Briefing', prompt: 'Give me our tactical briefing and pending priorities.' },
                  { label: 'Red-Team Test', prompt: 'Act as my adversarial sparring partner and stress-test my upcoming plan.' },
                  { label: 'Create Objective', prompt: 'Add a new high-priority objective to our radar.' },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => handleSendMessage(chip.prompt)}
                    className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-slate-900/90 hover:bg-cyan-950 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 transition-all"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Communication Feed & Tool Stream */}
            <div className="border border-cyan-500/20 bg-hud-glass rounded-2xl p-3 shadow-xl flex-1 flex flex-col min-h-[320px] overflow-hidden">
              <div className="flex items-center justify-between pb-2 border-b border-cyan-500/20 mb-2 text-xs font-mono text-cyan-400">
                <div className="flex items-center space-x-2">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>TRANSMISSIONS</span>
                </div>
                <span className="text-[10px] text-slate-400">{messages.length} LOGS</span>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs sm:text-sm max-h-[40vh]">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 mb-1 text-[10px] font-mono text-slate-400">
                      <span>{msg.role === 'user' ? 'SIR' : 'J.A.R.V.I.S.'}</span>
                      <span>•</span>
                      <span>{msg.timestamp}</span>
                    </div>

                    <div
                      className={`max-w-[90%] p-3 rounded-2xl ${
                        msg.role === 'user'
                          ? 'bg-cyan-950/80 border border-cyan-500/40 text-cyan-100 rounded-tr-none'
                          : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-none'
                      }`}
                    >
                      {msg.image && (
                        <div className="mb-2 rounded-lg overflow-hidden border border-cyan-500/30">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={msg.image} alt="Visual Uplink" className="max-h-48 w-full object-cover" />
                        </div>
                      )}
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>

              {/* Multimodal Input Bar */}
              <div className="mt-2 flex items-center space-x-2 pt-2 border-t border-cyan-500/20">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-400 text-slate-400 hover:text-cyan-300 transition-colors shrink-0"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendMessage();
                  }}
                  placeholder="Direct orders for J.A.R.V.I.S., Sir..."
                  className="flex-1 bg-slate-900/90 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs font-sans text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim() && !selectedImage}
                  className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-black font-bold transition-all shrink-0"
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
      </div>

      {/* ========================================================================= */}
      {/* DESKTOP VIEW (hidden lg:grid) — Dual Column Tactical Battle Station       */}
      {/* ========================================================================= */}
      <div className="hidden lg:grid max-w-7xl w-full mx-auto p-5 grid-cols-12 gap-5 flex-1">
        {/* Left Column: Arc Reactor Core & Active Communication Feed (7 cols) */}
        <div className="col-span-7 flex flex-col space-y-4">
          <DirectiveBadge />

          <div className="border border-cyan-500/20 bg-hud-glass rounded-2xl p-6 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center">
            <div className="absolute top-2 left-3 text-[10px] font-mono text-cyan-500/60 uppercase tracking-widest flex items-center space-x-1">
              <Zap className="w-3 h-3 text-cyan-400" />
              <span>NEURAL ARC REACTOR // VOICE UPLINK</span>
            </div>

            <ArcReactorOrb
              status={orbStatus}
              onToggleListen={toggleListening}
              audioLevel={audioLevel}
            />

            <div className="mt-2 flex flex-wrap gap-1.5 justify-center">
              {[
                { label: 'Tactical Briefing', prompt: 'Give me our tactical briefing and pending priorities.' },
                { label: 'Red-Team Stress Test', prompt: 'Act as my adversarial sparring partner and stress-test my upcoming plan.' },
                { label: 'Scan Whiteboard/Doc', prompt: 'I have uploaded a visual asset, analyze and extract action items.' },
                { label: 'Create Objective', prompt: 'Add a new high-priority objective to our radar.' },
              ].map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => handleSendMessage(chip.prompt)}
                  className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-slate-900/80 hover:bg-cyan-950 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 transition-all"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conversational Feed */}
          <div className="border border-cyan-500/20 bg-hud-glass rounded-2xl p-4 shadow-xl flex-1 flex flex-col min-h-[380px] max-h-[520px]">
            <div className="flex items-center justify-between pb-2 border-b border-cyan-500/20 mb-3 text-xs font-mono text-cyan-400">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4" />
                <span>COMMUNICATION FEED & TOOL STREAM</span>
              </div>
              <span className="text-[10px] text-slate-400">
                {messages.length} TRANSMISSIONS
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-sm">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1 text-[10px] font-mono text-slate-400">
                    <span>{msg.role === 'user' ? 'SIR' : 'J.A.R.V.I.S.'}</span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  <div
                    className={`max-w-[85%] p-3.5 rounded-2xl ${
                      msg.role === 'user'
                        ? 'bg-cyan-950/80 border border-cyan-500/40 text-cyan-100 rounded-tr-none shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                        : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-none shadow-md'
                    }`}
                  >
                    {msg.image && (
                      <div className="mb-2 rounded-lg overflow-hidden border border-cyan-500/30">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={msg.image} alt="Visual Uplink" className="max-h-60 w-full object-cover" />
                      </div>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-cyan-500/20 text-[11px] font-mono space-y-1">
                        <div className="text-cyan-400 font-bold flex items-center space-x-1">
                          <Activity className="w-3 h-3" />
                          <span>AUTONOMOUS ACTIONS EXECUTED:</span>
                        </div>
                        {msg.toolCalls.map((tc, idx) => (
                          <div key={idx} className="bg-slate-950/60 p-1.5 rounded border border-cyan-500/10 text-slate-300">
                            <span className="text-cyan-300">{tc.name}</span>
                            <span className="text-slate-500"> — {tc.result?.message || 'Completed'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

            {/* Input Bar */}
            <div className="mt-3 flex items-center space-x-2 pt-2 border-t border-cyan-500/20">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach visual asset"
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-400 text-slate-400 hover:text-cyan-300 transition-colors shrink-0"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendMessage();
                }}
                placeholder="Transmit command, thought, or inquiry, Sir..."
                className="flex-1 bg-slate-900/90 border border-slate-700 focus:border-cyan-400 rounded-xl px-4 py-2.5 text-sm font-sans text-slate-100 placeholder-slate-500 focus:outline-none transition-all shadow-inner"
              />
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() && !selectedImage}
                className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-black font-bold transition-all shrink-0 shadow-[0_0_15px_rgba(0,229,255,0.4)]"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Mission Control Tactical Radar (5 cols) */}
        <div className="col-span-5 flex flex-col space-y-4">
          <div className="flex border border-cyan-500/30 rounded-lg p-1 bg-slate-950 font-mono text-xs">
            <button
              onClick={() => setDesktopTab('TASKS')}
              className={`flex-1 py-1.5 rounded transition-colors ${
                desktopTab === 'TASKS' ? 'bg-cyan-500 text-black font-bold' : 'text-slate-400'
              }`}
            >
              OBJECTIVES ({tasks.filter((t) => t.status !== 'COMPLETED').length})
            </button>
            <button
              onClick={() => setDesktopTab('MEMORY')}
              className={`flex-1 py-1.5 rounded transition-colors ${
                desktopTab === 'MEMORY' ? 'bg-cyan-500 text-black font-bold' : 'text-slate-400'
              }`}
            >
              MEMORY ({memories.length})
            </button>
          </div>

          <div className={`flex-1 ${desktopTab === 'MEMORY' ? 'hidden' : 'block'}`}>
            <TaskMatrix
              tasks={tasks}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
              onAddTask={handleAddTask}
            />
          </div>

          <div className={`flex-1 ${desktopTab === 'TASKS' ? 'hidden' : 'block'}`}>
            <MemoryVault
              memories={memories}
              evolutionStage={evolutionStage}
              onAddMemory={handleAddMemory}
            />
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
        selectedModel={selectedModel}
        onSelectModel={(mod) => {
          setSelectedModel(mod);
          localStorage.setItem('jarvis_model', mod);
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
