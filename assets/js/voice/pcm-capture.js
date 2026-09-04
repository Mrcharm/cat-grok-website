const toInt16 = sample => {
  const clipped = Math.max(-1, Math.min(1, sample));
  return Math.round(clipped < 0 ? clipped * 32768 : clipped * 32767);
};

export function downsampleFloat32(samples, fromRate, toRate) {
  if (fromRate < toRate) throw new Error('PCM capture does not upsample input');
  if (fromRate === toRate) return Int16Array.from(samples, toInt16);

  const ratio = fromRate / toRate;
  const output = new Int16Array(Math.floor(samples.length / ratio));
  for (let index = 0; index < output.length; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.max(start + 1, Math.floor((index + 1) * ratio));
    let sum = 0;
    for (let source = start; source < end && source < samples.length; source += 1) {
      sum += samples[source];
    }
    output[index] = toInt16(sum / Math.max(1, end - start));
  }
  return output;
}

export function splitPcmChunks(samples, chunkSamples = 320) {
  if (!Number.isSafeInteger(chunkSamples) || chunkSamples <= 0) {
    throw new Error('chunkSamples must be a positive integer');
  }
  const chunks = [];
  for (let offset = 0; offset < samples.length; offset += chunkSamples) {
    chunks.push(samples.slice(offset, Math.min(samples.length, offset + chunkSamples)));
  }
  return chunks;
}

const int16ToBytes = samples => new Uint8Array(
  samples.buffer.slice(samples.byteOffset, samples.byteOffset + samples.byteLength)
);

export class PcmCapture {
  #navigator;
  #AudioContext;
  #AudioWorkletNode;
  #context;
  #stream;
  #source;
  #worklet;
  #pending = new Int16Array(0);

  constructor({
    navigatorRef = globalThis.navigator,
    AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext,
    AudioWorkletNodeClass = globalThis.AudioWorkletNode
  } = {}) {
    this.#navigator = navigatorRef;
    this.#AudioContext = AudioContextClass;
    this.#AudioWorkletNode = AudioWorkletNodeClass;
  }

  async start(onChunk) {
    if (this.#context) return;
    if (!this.#navigator?.mediaDevices?.getUserMedia || !this.#AudioContext || !this.#AudioWorkletNode) {
      throw new Error('REALTIME_AUDIO_UNSUPPORTED');
    }
    this.#stream = await this.#navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    this.#context = new this.#AudioContext();
    await this.#context.audioWorklet.addModule(new URL('./pcm-worklet.js', import.meta.url));
    this.#source = this.#context.createMediaStreamSource(this.#stream);
    this.#worklet = new this.#AudioWorkletNode(this.#context, 'jarvis-pcm-capture');
    this.#worklet.port.onmessage = event => {
      const converted = downsampleFloat32(event.data, this.#context.sampleRate, 16000);
      const merged = new Int16Array(this.#pending.length + converted.length);
      merged.set(this.#pending);
      merged.set(converted, this.#pending.length);
      const fullLength = Math.floor(merged.length / 320) * 320;
      for (const chunk of splitPcmChunks(merged.subarray(0, fullLength), 320)) {
        onChunk(int16ToBytes(chunk));
      }
      this.#pending = merged.slice(fullLength);
    };
    this.#source.connect(this.#worklet);
    this.#worklet.connect(this.#context.destination);
  }

  async stop() {
    this.#worklet?.disconnect();
    this.#source?.disconnect();
    for (const track of this.#stream?.getTracks?.() || []) track.stop();
    if (this.#context && this.#context.state !== 'closed') await this.#context.close();
    this.#pending = new Int16Array(0);
    this.#context = undefined;
    this.#stream = undefined;
    this.#source = undefined;
    this.#worklet = undefined;
  }
}
