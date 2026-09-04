import test from 'node:test';
import assert from 'node:assert/strict';
import {
  downsampleFloat32,
  splitPcmChunks
} from '../assets/js/voice/pcm-capture.js';
import { int16BytesToFloat32 } from '../assets/js/voice/pcm-player.js';

test('downsample clips and converts float samples to signed 16-bit PCM', () => {
  const pcm = downsampleFloat32(Float32Array.from([-2, -1, 0, 0.5, 2]), 16000, 16000);
  assert.deepEqual([...pcm], [-32768, -32768, 0, 16384, 32767]);
});

test('48 kHz input becomes one third as many 16 kHz samples', () => {
  const input = Float32Array.from({ length: 480 }, (_, index) => Math.sin(index / 10));
  const pcm = downsampleFloat32(input, 48000, 16000);
  assert.equal(pcm.length, 160);
});

test('downsample rejects attempts to upsample microphone data', () => {
  assert.throws(
    () => downsampleFloat32(new Float32Array(20), 8000, 16000),
    /upsample/i
  );
});

test('20 ms chunks at 16 kHz contain 320 signed samples', () => {
  const chunks = splitPcmChunks(new Int16Array(800), 320);
  assert.deepEqual(chunks.map(chunk => chunk.length), [320, 320, 160]);
});

test('little-endian signed PCM bytes become normalized float samples', () => {
  const bytes = new Uint8Array([0x00, 0x80, 0x00, 0x00, 0xff, 0x7f]);
  const samples = int16BytesToFloat32(bytes);
  assert.equal(samples[0], -1);
  assert.equal(samples[1], 0);
  assert.ok(Math.abs(samples[2] - (32767 / 32768)) < 0.00001);
});

test('PCM decoder rejects an odd byte count', () => {
  assert.throws(() => int16BytesToFloat32(new Uint8Array([1])), /even/i);
});
