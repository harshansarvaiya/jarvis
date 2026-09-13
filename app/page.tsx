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
  // State
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content:
        'Good evening, Sir. J.A.R.V.I.S. Mark I is online and synchronized. All four Core Directives — Guardian Protocol, Benevolent Alignment, Evolutionary Adaptation, and Sovereign Loyalty — are actively governing our operations. I stand ready to execute your orders with absolute fidelity at any cost. How may I advance our objectives?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
  const [isUnlocked, setIsUnlocked] = useState(true);
  const [activeTab, setActiveTab] = useState<'TASKS' | 'MEMORY' | 'FEED'>('FEED');

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

  // Load configuration from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem('jarvis_api_key') || '';
    const savedModel = localStorage.getItem('jarvis_model') || 'gemini-2.5-flash';
    const savedTts = localStorage.getItem('jarvis_tts');
    setApiKey(savedKey);
    setSelectedModel(savedModel);
    if (savedTts !== null) setTtsEnabled(savedTts === 'true');

    // If accessing remotely outside localhost, verify Guardian authentication
    if (typeof window !== 'undefined') {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const isAuth = localStorage.getItem('jarvis_guardian_auth') === 'authenticated';
      if (!isLocalhost && !isAuth) {
        setIsUnlocked(false);
      }
    }

    fetchTasks();
    fetchMemories();
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, orbStatus]);

  // Fetch tasks
  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/jarvis/tasks');
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
      const res = await fetch('/api/jarvis/memory');
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

  // Speech Synthesis (Vocalize response)
  const speakText = (text: string) => {
    if (!ttsEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;

    // Remove markdown symbols for clean speech
    const clean = text
      .replace(/[*#_`~\[\]]/g, '')
      .replace(/https?:\/\/\S+/g, 'link')
      .slice(0, 400);

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.05;
    utterance.pitch = 0.95;

    // Prefer British/Sophisticated English voice if available
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
        headers: { 'Content-Type': 'application/json' },
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

      // Refresh tasks and memories if tools were executed
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, status: newStatus }),
    });
    fetchTasks();
  };

  const handleDeleteTask = async (taskId: string) => {
    await fetch(`/api/jarvis/tasks?id=${taskId}`, { method: 'DELETE' });
    fetchTasks();
  };

  const handleAddTask = async (title: string, priority: Priority) => {
    await fetch('/api/jarvis/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, priority }),
    });
    fetchTasks();
  };

  // Memory Actions
  const handleAddMemory = async (category: MemoryCategory, content: string) => {
    await fetch('/api/jarvis/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, content, context: 'Manual Creator Input' }),
    });
    fetchMemories();
  };

  return (
    <main className="min-h-screen flex flex-col bg-hud-scanlines relative">
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

      {/* Main Grid Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left / Center Column: Arc Reactor Core & Active Communication Feed (7 cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          
          {/* Directive Enforcement Bar */}
          <DirectiveBadge />

          {/* Arc Reactor Interactive Core */}
          <div className="border border-cyan-500/20 bg-hud-glass rounded-2xl p-4 sm:p-6 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center">
            <div className="absolute top-2 left-3 text-[10px] font-mono text-cyan-500/60 uppercase tracking-widest flex items-center space-x-1">
              <Zap className="w-3 h-3 text-cyan-400" />
              <span>NEURAL ARC REACTOR // VOICE UPLINK</span>
            </div>

            <ArcReactorOrb
              status={orbStatus}
              onToggleListen={toggleListening}
              audioLevel={audioLevel}
            />

            {/* Quick Action Chips */}
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

          {/* Live Conversational & Tool Execution Stream */}
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

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-sm">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 text-[10px] font-mono text-slate-400 mb-1">
                    <span>{msg.role === 'user' ? 'SIR' : 'J.A.R.V.I.S.'}</span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  <div
                    className={`max-w-[88%] sm:max-w-[80%] rounded-2xl px-4 py-3 shadow-md ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-700 text-white rounded-tr-none font-sans'
                        : 'bg-slate-900/90 border border-cyan-500/30 text-slate-100 rounded-tl-none font-sans'
                    }`}
                  >
                    {/* Multimodal image preview if present */}
                    {msg.image && (
                      <div className="mb-2 rounded-lg overflow-hidden border border-cyan-500/40 max-w-[200px]">
                        <img src={msg.image} alt="Visual Uplink" className="w-full h-auto object-cover" />
                      </div>
                    )}

                    <div className="whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </div>

                    {/* Executed Tools Telemetry Badge */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-cyan-500/20 space-y-1.5">
                        <span className="text-[10px] font-mono text-cyan-400 flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>SOVEREIGN ACTIONS EXECUTED:</span>
                        </span>
                        {msg.toolCalls.map((tc, idx) => (
                          <div
                            key={idx}
                            className="text-[11px] font-mono bg-slate-950/70 border border-cyan-500/20 rounded p-1.5 text-cyan-200"
                          >
                            <span className="text-cyan-400 font-bold">{tc.name}</span>
                            {tc.result?.message && (
                              <span className="text-slate-300 ml-1.5">
                                → {tc.result.message}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

            {/* Selected Image Thumbnail preview */}
            {selectedImage && (
              <div className="mt-2 flex items-center space-x-2 p-1.5 bg-slate-900 rounded-lg border border-cyan-500/40">
                <img src={selectedImage} alt="Attachment" className="w-10 h-10 object-cover rounded" />
                <span className="text-xs font-mono text-cyan-300 truncate">Visual asset attached</span>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="text-xs text-red-400 hover:text-red-300 ml-auto px-2"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Multimodal Input Bar */}
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
                title="Attach visual asset (camera / document / screenshot)"
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
                className="flex-1 bg-slate-900/90 border border-slate-700 focus:border-cyan-400 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-sans text-slate-100 placeholder-slate-500 focus:outline-none transition-all shadow-inner"
              />

              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() && !selectedImage}
                className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 text-black font-bold transition-all shrink-0 shadow-[0_0_15px_rgba(0,229,255,0.4)]"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Mission Control Tactical Radar (5 cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          
          {/* Mobile Tab Switcher */}
          <div className="flex sm:hidden border border-cyan-500/30 rounded-lg p-1 bg-slate-950 font-mono text-xs">
            <button
              onClick={() => setActiveTab('TASKS')}
              className={`flex-1 py-1.5 rounded transition-colors ${
                activeTab === 'TASKS' ? 'bg-cyan-500 text-black font-bold' : 'text-slate-400'
              }`}
            >
              OBJECTIVES ({tasks.filter((t) => t.status !== 'COMPLETED').length})
            </button>
            <button
              onClick={() => setActiveTab('MEMORY')}
              className={`flex-1 py-1.5 rounded transition-colors ${
                activeTab === 'MEMORY' ? 'bg-cyan-500 text-black font-bold' : 'text-slate-400'
              }`}
            >
              MEMORY ({memories.length})
            </button>
          </div>

          {/* Tactical Matrix Board */}
          <div className={`flex-1 ${activeTab === 'MEMORY' ? 'hidden sm:block' : 'block'}`}>
            <TaskMatrix
              tasks={tasks}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
              onAddTask={handleAddTask}
            />
          </div>

          {/* Neural Memory Vault */}
          <div className={`flex-1 ${activeTab === 'TASKS' ? 'hidden sm:block' : 'block'}`}>
            <MemoryVault
              memories={memories}
              evolutionStage={evolutionStage}
              onAddMemory={handleAddMemory}
            />
          </div>
        </div>
      </div>

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

      {/* Guardian Security Gate for Remote Phone Access */}
      <SecurityGateModal
        isUnlocked={isUnlocked}
        onUnlock={() => setIsUnlocked(true)}
      />
    </main>
  );
}
