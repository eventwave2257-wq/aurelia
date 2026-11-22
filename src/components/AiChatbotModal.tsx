import { useState, useRef, useEffect, useCallback } from 'react';
import {
  AlertCircle,
  Bot,
  MessageSquare,
  Mic,
  MicOff,
  Radio,
  Send,
  Settings2,
  Sparkles,
  User,
  X,
} from 'lucide-react';

interface Message {
  role: 'user' | 'model';
  text: string;
}

type ChatModeTab = 'text' | 'voice';
type GeminiChatModel = 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';

interface AiChatbotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_SYSTEM_INSTRUCTION =
  'You are Aurelia AI Fleet Assistant & Karnataka Chauffeur Expert, specialized in executive rides, special care medical transport, ₹19/km tariffs, flat ₹3/ride settlement transfers, navigation across all 31 Karnataka districts, speed limits (50 km/hr bike, 95 km/hr car), and High Earning Zones.';

export function AiChatbotModal({ isOpen, onClose }: AiChatbotModalProps) {
  const [activeTab, setActiveTab] = useState<ChatModeTab>('text');
  const [selectedModel, setSelectedModel] = useState<GeminiChatModel>('gemini-4-hydrogen');
  const [systemInstruction, setSystemInstruction] = useState<string>(DEFAULT_SYSTEM_INSTRUCTION);
  const [showInstructions, setShowInstructions] = useState<boolean>(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: 'Namaste! I am your Aurelia Fleet AI Assistant powered by Gemini 4 Hydrogen. Ask me about Karnataka routes across 31 districts, flat ₹3/ride fee settlements, speed compliance (50 km/hr bike, 95 km/hr car), or switch to Live Voice to speak hands-free.',
    },
  ]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Gemini Live Voice state
  const [voiceActive, setVoiceActive] = useState<boolean>(false);
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceTranscripts, setVoiceTranscripts] = useState<Message[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, voiceTranscripts, isOpen]);

  const stopVoiceSession = useCallback(() => {
    try {
      wsRef.current?.close();
    } catch {
      // ignore
    }
    wsRef.current = null;

    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;

    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      void audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    nextStartTimeRef.current = 0;

    setVoiceActive(false);
    setVoiceStatus('idle');
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopVoiceSession();
    }
  }, [isOpen, stopVoiceSession]);

  const schedulePcmAudio = useCallback((base64Data: string) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now + 0.02, nextStartTimeRef.current);
    source.start(startAt);
    nextStartTimeRef.current = startAt + audioBuffer.duration;
  }, []);

  const startVoiceSession = async () => {
    setVoiceError(null);
    setVoiceStatus('connecting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const CtxCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new CtxCtor({ sampleRate: 16000 });
      audioCtxRef.current = ctx;
      nextStartTimeRef.current = ctx.currentTime;

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/api/gemini/live`);
      wsRef.current = ws;

      ws.onopen = () => {
        setVoiceActive(true);
        setVoiceStatus('live');

        // Stream 16kHz PCM audio frames over WebSocket
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = (event) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const floatSamples = event.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(floatSamples.length);
          for (let i = 0; i < floatSamples.length; i++) {
            const clamped = Math.max(-1, Math.min(1, floatSamples[i]));
            int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
          }
          const bytes = new Uint8Array(int16.buffer);
          let bin = '';
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          ws.send(JSON.stringify({ type: 'audio', data: btoa(bin) }));
        };
        source.connect(processor);
        processor.connect(ctx.destination);
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'audio' && msg.data) {
            schedulePcmAudio(msg.data);
          } else if (msg.type === 'interrupted') {
            nextStartTimeRef.current = audioCtxRef.current?.currentTime ?? 0;
          } else if (msg.type === 'input_transcript' && msg.text) {
            setVoiceTranscripts((prev) => [...prev, { role: 'user', text: msg.text }]);
          } else if (msg.type === 'output_transcript' && msg.text) {
            setVoiceTranscripts((prev) => [...prev, { role: 'model', text: msg.text }]);
          } else if (msg.type === 'error') {
            setVoiceError(msg.error || 'Gemini Live connection error.');
            setVoiceStatus('error');
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onerror = () => {
        setVoiceError('WebSocket connection error while starting Gemini 3.8 Live Voice.');
        setVoiceStatus('error');
      };

      ws.onclose = () => {
        setVoiceActive(false);
        setVoiceStatus((prev) => (prev === 'error' ? 'error' : 'idle'));
      };
    } catch (err: any) {
      setVoiceError(
        err?.message || 'Microphone access or Live Voice initialization failed.'
      );
      setVoiceStatus('error');
      stopVoiceSession();
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');
    setChatError(null);
    const newMessages: Message[] = [...messages, { role: 'user', text: userText }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          systemInstruction,
          messages: newMessages,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }

      setMessages([...newMessages, { role: 'model', text: data.reply }]);
    } catch (err: any) {
      setChatError(err?.message || 'Failed to connect to Gemini AI service.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Aurelia Gemini AI Chatbot"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
    >
      <div className="w-full max-w-lg h-[620px] rounded-3xl bg-white/95 dark:bg-[#101218]/95 backdrop-blur-2xl border border-amber-300/60 dark:border-amber-500/30 flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent dark:from-amber-400/15 dark:to-transparent border-b border-stone-200 dark:border-white/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-amber-500/20 dark:bg-amber-400/20 border border-amber-300 dark:border-amber-500/40 flex items-center justify-center text-amber-700 dark:text-amber-300">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-stone-900 dark:text-stone-50">
                  Aurelia Fleet AI Copilot
                </h3>
                <p className="text-[11px] font-mono-tabular text-stone-500 dark:text-stone-400">
                  {activeTab === 'voice'
                    ? 'Gemini 3.8 Live · Bidirectional Voice'
                    : selectedModel === 'gemini-4-hydrogen'
                      ? 'Gemini 4 Hydrogen · Multi-Turn Chat'
                      : 'Gemini 3.1 Flash Lite · Low Latency'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close chatbot"
              className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-stone-500 hover:text-stone-900 dark:hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Tabs + Model Selector */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-100 dark:bg-[#080A0F] border border-stone-200 dark:border-white/10">
              <button
                type="button"
                data-testid="ai-tab-text"
                onClick={() => setActiveTab('text')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'text'
                    ? 'bg-white dark:bg-[#D4AF63] text-stone-900 dark:text-stone-950 shadow-sm'
                    : 'text-stone-600 dark:text-stone-300'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Multi-Turn Chat</span>
              </button>
              <button
                type="button"
                data-testid="ai-tab-voice"
                onClick={() => setActiveTab('voice')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'voice'
                    ? 'bg-white dark:bg-[#D4AF63] text-stone-900 dark:text-stone-950 shadow-sm'
                    : 'text-stone-600 dark:text-stone-300'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Live Voice</span>
              </button>
            </div>

            {activeTab === 'text' && (
              <div className="flex items-center gap-1.5">
                <select
                  aria-label="Select Gemini chat model"
                  data-testid="gemini-model-select"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as GeminiChatModel)}
                  className="px-2.5 py-1.5 rounded-xl bg-stone-100 dark:bg-[#080A0F] border border-stone-200 dark:border-white/10 text-[11px] font-semibold text-stone-800 dark:text-stone-200"
                >
                  <option value="gemini-4-hydrogen">Gemini 4 Hydrogen</option>
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
                </select>
                <button
                  type="button"
                  onClick={() => setShowInstructions((prev) => !prev)}
                  title="System Instructions"
                  className="p-1.5 rounded-xl border border-stone-200 dark:border-white/10 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/10 cursor-pointer"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {activeTab === 'text' && showInstructions && (
            <textarea
              rows={2}
              value={systemInstruction}
              onChange={(e) => setSystemInstruction(e.target.value)}
              aria-label="System instruction for AI assistant"
              className="w-full p-2.5 rounded-xl bg-stone-50 dark:bg-[#080A0F] border border-stone-200 dark:border-white/10 text-[11px] text-stone-800 dark:text-stone-200"
            />
          )}
        </div>

        {activeTab === 'text' ? (
          <>
            {/* Message Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-stone-50/50 dark:bg-[#080A0F]/50">
              {messages.map((msg, idx) => {
                const isModel = msg.role === 'model';
                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-2.5 ${isModel ? '' : 'flex-row-reverse'}`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                        isModel
                          ? 'bg-amber-500/20 text-amber-800 dark:bg-amber-400/20 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40'
                          : 'bg-[#B48A3E] dark:bg-[#D4AF63] text-white dark:text-stone-950'
                      }`}
                    >
                      {isModel ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </div>

                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                        isModel
                          ? 'bg-white dark:bg-[#151821] border border-stone-200/80 dark:border-white/10 text-stone-900 dark:text-stone-100 shadow-sm'
                          : 'bg-[#B48A3E] dark:bg-[#D4AF63] text-white dark:text-stone-950 font-medium'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })}

              {chatError && (
                <div
                  role="alert"
                  className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-700 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{chatError}</span>
                </div>
              )}

              {loading && (
                <div className="flex items-center gap-2 text-stone-500 text-xs font-mono-tabular p-2">
                  <Sparkles className="w-4 h-4 animate-spin text-amber-600 dark:text-amber-400" />
                  <span>Generating multi-turn response...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form
              onSubmit={handleSend}
              className="p-3 bg-white dark:bg-[#101218] border-t border-stone-200 dark:border-white/10 flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about Bangalore traffic, districts, or ₹3/ride settlement..."
                className="flex-1 min-h-[44px] px-4 rounded-2xl bg-stone-100 dark:bg-[#080A0F] border border-stone-200 dark:border-white/10 text-xs sm:text-sm text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="min-h-[44px] px-4 rounded-2xl bg-[#B48A3E] hover:bg-[#9A722A] dark:bg-[#D4AF63] dark:hover:bg-[#E2C27D] text-white dark:text-stone-950 font-semibold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Send</span>
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col justify-between p-5 bg-stone-50/50 dark:bg-[#080A0F]/60">
            <div className="space-y-4">
              <div className="p-5 rounded-3xl bg-white dark:bg-[#151821] border border-stone-200 dark:border-white/10 text-center space-y-3 shadow-sm">
                <div
                  className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center border ${
                    voiceStatus === 'live'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500 animate-pulse'
                      : 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-[#D4AF63]'
                  }`}
                >
                  <Radio className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-display text-lg font-bold text-stone-900 dark:text-white">
                    Hands-Free Voice Assistant
                  </h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Real-time 16kHz mic streaming &amp; 24kHz audio playback via Gemini 3.8 Live
                  </p>
                </div>

                {voiceError && (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-700 text-xs text-rose-800 dark:text-rose-200 text-left flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{voiceError}</span>
                  </div>
                )}

                <div className="pt-1">
                  {voiceActive ? (
                    <button
                      type="button"
                      data-testid="stop-live-voice-btn"
                      onClick={stopVoiceSession}
                      className="min-h-[46px] px-6 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
                    >
                      <MicOff className="w-4 h-4" />
                      <span>End Voice Session</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-testid="start-live-voice-btn"
                      disabled={voiceStatus === 'connecting'}
                      onClick={() => void startVoiceSession()}
                      className="min-h-[46px] px-6 rounded-2xl bg-[#B48A3E] hover:bg-[#9A722A] dark:bg-[#D4AF63] dark:hover:bg-[#E2C27D] text-white dark:text-stone-950 text-xs font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Mic className="w-4 h-4" />
                      <span>
                        {voiceStatus === 'connecting'
                          ? 'Connecting Gemini Live...'
                          : 'Start Live Voice Session'}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Live Transcripts */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#151821] border border-stone-200 dark:border-white/10 h-56 overflow-y-auto space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500 dark:text-stone-400">
                  Live Conversation Transcript
                </p>
                {voiceTranscripts.length === 0 ? (
                  <p className="text-xs text-stone-500 dark:text-stone-400 pt-4 text-center">
                    Start a voice session and speak naturally to see live transcripts here.
                  </p>
                ) : (
                  voiceTranscripts.map((t, idx) => (
                    <p key={idx} className="text-xs text-stone-800 dark:text-stone-200">
                      <strong className="text-[#9A722A] dark:text-[#D4AF63]">
                        {t.role === 'user' ? 'You: ' : 'Aurelia: '}
                      </strong>
                      {t.text}
                    </p>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
