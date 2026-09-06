import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeOutputPcm } from '../assets/js/voice/duplex-controller.js';

test('Doubao pcm output decodes float32 little endian without int16 noise', () => {
  const bytes = Buffer.from('0070803d00c0823d0060843d', 'hex');
  const samples = decodeOutputPcm(bytes);
  assert.equal(samples.length, 3);
  assert.equal(samples[0], bytes.readFloatLE(0));
  assert.ok(samples.every(x => x > 0.06 && x < 0.07));
});
test('invalid output is rejected rather than played as noise', () => {
  assert.throws(() => decodeOutputPcm(new Uint8Array([1, 2, 3])));
  assert.throws(() => decodeOutputPcm(Buffer.from('0000807f', 'hex')));
});
