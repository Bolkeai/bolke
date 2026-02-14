/**
 * Native Audio Streaming Service
 * Handles real-time audio streaming with Gemini Live API via WebSocket
 */

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws/audio';

// Audio configuration
const AUDIO_CONFIG = {
  sampleRate: 16000,  // 16kHz for sending
  channels: 1,         // Mono
  bitDepth: 16,        // 16-bit PCM
};

const PLAYBACK_SAMPLE_RATE = 24000;  // Gemini outputs 24kHz

export class NativeAudioStreamer {
  private ws: WebSocket | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sessionId: string;
  private isStreaming: boolean = false;
  private playbackQueue: AudioBuffer[] = [];
  private isPlaying: boolean = false;

  constructor(sessionId?: string) {
    this.sessionId = sessionId || `session-${Date.now()}`;
  }

  /**
   * Start streaming audio to/from backend
   */
  async startStreaming(
    onStart?: () => void,
    onResponse?: () => void,
    onError?: (error: string) => void
  ): Promise<void> {
    try {
      console.log('🎙️ Starting native audio stream...');

      // Initialize audio context
      this.audioContext = new AudioContext({ sampleRate: AUDIO_CONFIG.sampleRate });

      // Get microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: AUDIO_CONFIG.sampleRate,
          channelCount: AUDIO_CONFIG.channels,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      console.log('✅ Microphone access granted');

      // Connect WebSocket
      await this.connectWebSocket();

      // Start capturing and sending audio
      this.startMicrophoneCapture();

      // Start playing received audio
      this.startAudioPlayback();

      this.isStreaming = true;
      console.log('✅ Audio streaming started');
      onStart?.();

    } catch (error: any) {
      console.error('❌ Failed to start audio streaming:', error);
      onError?.(error.message || 'Failed to start audio streaming');
      throw error;
    }
  }

  /**
   * Stop streaming
   */
  stopStreaming(): void {
    console.log('🛑 Stopping audio stream...');

    this.isStreaming = false;

    // Stop microphone
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.playbackQueue = [];
    console.log('✅ Audio stream stopped');
  }

  /**
   * Connect to WebSocket
   */
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${WS_URL}?session_id=${this.sessionId}`;
      console.log('🔌 Connecting to WebSocket:', wsUrl);

      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        reject(new Error('WebSocket connection failed'));
      };

      this.ws.onmessage = (event) => {
        this.handleIncomingAudio(event.data);
      };

      this.ws.onclose = () => {
        console.log('🔌 WebSocket closed');
      };

      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 5000);
    });
  }

  /**
   * Start capturing audio from microphone and sending to WebSocket
   */
  private startMicrophoneCapture(): void {
    if (!this.audioContext || !this.mediaStream) return;

    const source = this.audioContext.createMediaStreamSource(this.mediaStream);

    // Create script processor for audio capture
    // Buffer size 4096 gives good balance between latency and performance
    this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.scriptProcessor.onaudioprocess = (event) => {
      if (!this.isStreaming || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return;
      }

      const inputData = event.inputBuffer.getChannelData(0);

      // Convert Float32Array to Int16Array (PCM 16-bit)
      const pcmData = this.float32ToInt16(inputData);

      // Send to WebSocket
      this.ws.send(pcmData.buffer);
    };

    source.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.audioContext.destination);

    console.log('🎤 Microphone capture started');
  }

  /**
   * Handle incoming audio from WebSocket
   */
  private handleIncomingAudio(data: ArrayBuffer): void {
    if (!this.audioContext) return;

    console.log(`📥 Received audio: ${data.byteLength} bytes`);

    // Convert Int16Array PCM to Float32Array
    const pcmData = new Int16Array(data);
    const floatData = this.int16ToFloat32(pcmData);

    // Create audio buffer (24kHz output from Gemini)
    const audioBuffer = this.audioContext.createBuffer(
      1,
      floatData.length,
      PLAYBACK_SAMPLE_RATE
    );

    audioBuffer.getChannelData(0).set(floatData);

    // Add to playback queue
    this.playbackQueue.push(audioBuffer);

    // Start playback if not already playing
    if (!this.isPlaying) {
      this.playNextBuffer();
    }
  }

  /**
   * Play audio buffers from queue
   */
  private startAudioPlayback(): void {
    // Playback is handled by playNextBuffer()
    console.log('🔊 Audio playback ready');
  }

  /**
   * Play next buffer in queue
   */
  private playNextBuffer(): void {
    if (!this.audioContext || this.playbackQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;

    const buffer = this.playbackQueue.shift()!;
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    source.onended = () => {
      this.playNextBuffer();
    };

    source.start();
    console.log('🔊 Playing audio chunk');
  }

  /**
   * Convert Float32Array to Int16Array (for sending)
   */
  private float32ToInt16(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
  }

  /**
   * Convert Int16Array to Float32Array (for playback)
   */
  private int16ToFloat32(int16Array: Int16Array): Float32Array {
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7fff);
    }
    return float32Array;
  }
}
