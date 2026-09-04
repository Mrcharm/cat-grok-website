export function int16BytesToFloat32(input) {
  const bytes = input instanceof Uint8Array
    ? input
    : new Uint8Array(input.buffer || input, input.byteOffset || 0, input.byteLength);
  if (bytes.byteLength % 2 !== 0) throw new Error('PCM byte length must be even');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const samples = new Float32Array(bytes.byteLength / 2);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = view.getInt16(index * 2, true) / 32768;
  }
  return samples;
}

export class PcmPlayer {
  #AudioContext;
  #context;
  #sources = new Set();
  #nextStart = 0;

  constructor({ AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
    this.#AudioContext = AudioContextClass;
  }

  async unlock() {
    if (!this.#AudioContext) throw new Error('REALTIME_AUDIO_UNSUPPORTED');
    if (!this.#context) this.#context = new this.#AudioContext({ sampleRate: 24000 });
    if (this.#context.state === 'suspended') await this.#context.resume();
  }

  enqueue(bytes) {
    if (!this.#context) throw new Error('PCM player is not unlocked');
    const samples = int16BytesToFloat32(bytes);
    const buffer = this.#context.createBuffer(1, samples.length, 24000);
    buffer.copyToChannel(samples, 0);
    const source = this.#context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.#context.destination);
    const now = this.#context.currentTime;
    if (this.#nextStart - now > 10) this.interrupt();
    const startAt = Math.max(now, this.#nextStart);
    this.#nextStart = startAt + buffer.duration;
    this.#sources.add(source);
    source.onended = () => this.#sources.delete(source);
    source.start(startAt);
  }

  interrupt() {
    for (const source of this.#sources) {
      try { source.stop(); } catch {}
    }
    this.#sources.clear();
    this.#nextStart = this.#context?.currentTime || 0;
  }

  async close() {
    this.interrupt();
    if (this.#context && this.#context.state !== 'closed') await this.#context.close();
    this.#context = undefined;
  }
}
