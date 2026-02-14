class PCMCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._bufferSize = 2048;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const samples = input[0];
    for (let i = 0; i < samples.length; i++) {
      this._buffer.push(samples[i]);
    }

    if (this._buffer.length >= this._bufferSize) {
      this.port.postMessage({ type: 'pcm', samples: new Float32Array(this._buffer) });
      this._buffer = [];
    }

    return true;
  }
}

registerProcessor('pcm-capture-processor', PCMCaptureProcessor);
