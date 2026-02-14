'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleGenAI, Modality, Type, StartSensitivity, EndSensitivity, type Session, type LiveServerMessage, type FunctionDeclaration } from '@google/genai';
import { Language } from '../lib/languages';
import { float32ToPCM16Base64, pcm16Base64ToFloat32 } from '../lib/audioWorklet';

export type AgentStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

interface UseLiveAgentOptions {
  language: Language;
  onToolCall?: (call: ToolCall) => Promise<unknown>;
  onTranscript?: (text: string, isAgent: boolean) => void;
}

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'search_products',
    description: 'Search for grocery products on Zepto and Blinkit. Call this when the user asks to find, see, or compare any product.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Product to search, e.g. "basmati rice 1kg" or "amul butter"',
        },
        platforms: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Platforms to search. Default: ["zepto", "blinkit"]',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'place_order',
    description: 'Place a real grocery order. Only call this after the user has explicitly confirmed they want to order.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        items: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Items to order, e.g. ["basmati rice 500g"]',
        },
        provider: {
          type: Type.STRING,
          description: 'Platform to order from: "zepto" or "blinkit"',
        },
      },
      required: ['items', 'provider'],
    },
  },
];

export function useLiveAgent({ language, onToolCall, onTranscript }: UseLiveAgentOptions) {
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<Session | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const playbackQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  // Track status in a ref so callbacks see current value without stale closures
  const statusRef = useRef<AgentStatus>('idle');

  const updateStatus = useCallback((s: AgentStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  // ── Playback ──────────────────────────────────────────────────────────────

  const playNextChunk = useCallback(() => {
    if (isPlayingRef.current || playbackQueueRef.current.length === 0) return;
    const ctx = outputCtxRef.current;
    if (!ctx) return;

    isPlayingRef.current = true;
    const samples = playbackQueueRef.current.shift()!;

    const buffer = ctx.createBuffer(1, samples.length, OUTPUT_SAMPLE_RATE);
    buffer.getChannelData(0).set(samples);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      isPlayingRef.current = false;
      if (playbackQueueRef.current.length > 0) {
        playNextChunk();
      } else if (statusRef.current === 'speaking') {
        updateStatus('listening');
      }
    };
    source.start();
    updateStatus('speaking');
  }, [updateStatus]);

  const enqueueAudio = useCallback((base64: string) => {
    const samples = pcm16Base64ToFloat32(base64);
    playbackQueueRef.current.push(samples);
    playNextChunk();
  }, [playNextChunk]);

  // ── Teardown ──────────────────────────────────────────────────────────────

  const teardown = useCallback(() => {
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;

    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;

    inputCtxRef.current?.close().catch(() => {});
    inputCtxRef.current = null;

    outputCtxRef.current?.close().catch(() => {});
    outputCtxRef.current = null;

    // Flush any buffered audio before closing
    try { sessionRef.current?.sendRealtimeInput({ audioStreamEnd: true }); } catch {}
    sessionRef.current?.close?.();
    sessionRef.current = null;

    playbackQueueRef.current = [];
    isPlayingRef.current = false;
  }, []);

  // ── Connect ───────────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    if (sessionRef.current) return;

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      setError('Missing NEXT_PUBLIC_GEMINI_API_KEY in .env.local');
      updateStatus('error');
      return;
    }

    updateStatus('connecting');
    setError(null);

    try {
      // 1. Request mic early — fail fast if denied
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;

      // 2. Set up output AudioContext for playback
      const outCtx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
      outputCtxRef.current = outCtx;

      // 3. Connect to Gemini Live
      // v1alpha needed for affectiveDialog
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { apiVersion: 'v1alpha' },
      });

      const session = await ai.live.connect({
        model: MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Puck' },
            },
          },
          systemInstruction: {
            parts: [{ text: language.systemPrompt }],
          },
          // Disable thinking — removes ~1-2s latency for conversational use
          thinkingConfig: { thinkingBudget: 0 },
          // Emotion-aware responses, more natural conversation
          enableAffectiveDialog: true,
          // Transcriptions
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          // VAD tuning — high start sensitivity catches softer/accented speech faster,
          // low end sensitivity avoids cutting off mid-sentence (critical for Indian languages)
          realtimeInputConfig: {
            automaticActivityDetection: {
              disabled: false,
              startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
              endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
              prefixPaddingMs: 20,
              silenceDurationMs: 500,
            },
          },
          tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
        },
        callbacks: {
          onopen: () => {
            console.log('[LiveAgent] Connected ✓');
            updateStatus('listening');
          },

          onmessage: async (msg: LiveServerMessage) => {
            // ── Audio from agent ──
            const parts = msg.serverContent?.modelTurn?.parts ?? [];
            for (const part of parts) {
              if (part.inlineData?.data && part.inlineData.mimeType?.startsWith('audio/pcm')) {
                enqueueAudio(part.inlineData.data);
              }
              if (part.text) {
                onTranscript?.(part.text, true);
              }
            }

            // ── Output transcription (what agent said) ──
            const outTranscript = msg.serverContent?.outputTranscription?.text;
            if (outTranscript) {
              onTranscript?.(outTranscript, true);
            }

            // ── Input transcription (what user said) ──
            const inTranscript = msg.serverContent?.inputTranscription?.text;
            if (inTranscript) {
              onTranscript?.(inTranscript, false);
              if (statusRef.current !== 'speaking') updateStatus('thinking');
            }

            // ── Interrupted — user spoke over agent, clear queued audio immediately ──
            if (msg.serverContent?.interrupted) {
              playbackQueueRef.current = [];
              isPlayingRef.current = false;
              updateStatus('listening');
            }

            // ── Turn complete ──
            if (msg.serverContent?.turnComplete) {
              if (playbackQueueRef.current.length === 0 && !isPlayingRef.current) {
                updateStatus('listening');
              }
            }

            // ── Tool call ──
            const fcs = msg.toolCall?.functionCalls;
            if (fcs?.length && onToolCall && sessionRef.current) {
              for (const fc of fcs) {
                const call: ToolCall = {
                  id: fc.id ?? '',
                  name: fc.name ?? '',
                  args: (fc.args as Record<string, unknown>) ?? {},
                };
                console.log('[LiveAgent] Tool call:', call.name, call.args);
                try {
                  const result = await onToolCall(call);
                  sessionRef.current.sendToolResponse({
                    functionResponses: [{
                      id: call.id,
                      name: call.name,
                      response: { output: result },
                    }],
                  });
                } catch (err) {
                  sessionRef.current.sendToolResponse({
                    functionResponses: [{
                      id: call.id,
                      name: call.name,
                      response: { error: String(err) },
                    }],
                  });
                }
              }
            }
          },

          onerror: (e: ErrorEvent) => {
            console.error('[LiveAgent] Error:', e);
            setError(e.message || 'Connection error');
            updateStatus('error');
          },

          onclose: (e: CloseEvent) => {
            console.warn('[LiveAgent] Closed — code:', e.code, 'reason:', e.reason, 'wasClean:', e.wasClean);
            // Only go to idle if we weren't already in error
            if (statusRef.current !== 'error') {
              if (e.code !== 1000) {
                // Abnormal close — show reason
                setError(e.reason || `Connection closed (code ${e.code})`);
                updateStatus('error');
              } else {
                updateStatus('idle');
              }
            }
          },
        },
      });

      sessionRef.current = session;

      // 4. Set up input AudioContext + AudioWorklet for mic capture
      const inCtx = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
      inputCtxRef.current = inCtx;

      await inCtx.audioWorklet.addModule('/worklet.js');

      const source = inCtx.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(inCtx, 'pcm-capture-processor');
      workletNodeRef.current = worklet;

      worklet.port.onmessage = (event) => {
        if (event.data.type === 'pcm' && sessionRef.current) {
          const base64 = float32ToPCM16Base64(event.data.samples);
          sessionRef.current.sendRealtimeInput({
            audio: { data: base64, mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}` },
          });
        }
      };

      source.connect(worklet);
      // Do NOT connect worklet to destination — we don't want mic echo

    } catch (err: any) {
      console.error('[LiveAgent] Connect failed:', err);
      setError(err?.message ?? 'Failed to connect');
      updateStatus('error');
      teardown();
    }
  }, [language, enqueueAudio, onToolCall, onTranscript, teardown, updateStatus]);

  // ── Disconnect ────────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    teardown();
    updateStatus('idle');
    setError(null);
  }, [teardown, updateStatus]);

  // Cleanup on unmount
  useEffect(() => () => { teardown(); }, [teardown]);

  // Disconnect when language changes mid-session
  useEffect(() => {
    if (sessionRef.current) disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language.code]);

  return { status, error, connect, disconnect };
}
