import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAigcTlvMessage } from '../assets/js/voice/rtc-aigc-message.js';

const encoder = new TextEncoder();

function officialTlvFixture(tag, payload) {
  const value = encoder.encode(typeof payload === 'string' ? payload : JSON.stringify(payload));
  const bytes = new Uint8Array(8 + value.length);
  for (let index = 0; index < 4; index += 1) bytes[index] = tag.charCodeAt(index);
  new DataView(bytes.buffer).setUint32(4, value.length, false);
  bytes.set(value, 8);
  return bytes.buffer;
}

test('parses the official AIGC subv TLV shape and its data array', () => {
  const payload = {
    data: [
      { userId: 'user_test', text: '你好', definite: true },
      { userId: 'bot_test', text: '我在', definite: false }
    ]
  };

  assert.deepEqual(parseAigcTlvMessage(officialTlvFixture('subv', payload)), {
    tag: 'subv',
    payload
  });
});

test('parses the official AIGC conv state TLV shape', () => {
  const payload = { Stage: { Code: 3, Description: 'Speaking' } };

  assert.deepEqual(parseAigcTlvMessage(officialTlvFixture('conv', payload)), {
    tag: 'conv',
    payload
  });
});

test('rejects truncated and length-mismatched TLV messages', () => {
  assert.throws(
    () => parseAigcTlvMessage(new Uint8Array([0x73, 0x75, 0x62]).buffer),
    error => error.code === 'RTC_AIGC_MESSAGE_INVALID'
  );

  const truncated = new Uint8Array(officialTlvFixture('subv', { data: [] })).slice(0, -1);
  assert.throws(
    () => parseAigcTlvMessage(truncated),
    error => error.code === 'RTC_AIGC_MESSAGE_INVALID'
  );

  const trailing = new Uint8Array(officialTlvFixture('subv', { data: [] }));
  const withTrailingByte = new Uint8Array(trailing.length + 1);
  withTrailingByte.set(trailing);
  assert.throws(
    () => parseAigcTlvMessage(withTrailingByte),
    error => error.code === 'RTC_AIGC_MESSAGE_INVALID'
  );
});

test('rejects invalid UTF-8 and malformed JSON in accepted messages', () => {
  const invalidUtf8 = new Uint8Array(10);
  invalidUtf8.set(encoder.encode('subv'));
  new DataView(invalidUtf8.buffer).setUint32(4, 2, false);
  invalidUtf8.set([0xc3, 0x28], 8);
  assert.throws(
    () => parseAigcTlvMessage(invalidUtf8),
    error => error.code === 'RTC_AIGC_MESSAGE_INVALID'
  );

  assert.throws(
    () => parseAigcTlvMessage(officialTlvFixture('subv', '{bad json')),
    error => error.code === 'RTC_AIGC_MESSAGE_INVALID'
  );
});

test('ignores a well-formed TLV with an unknown AIGC tag', () => {
  assert.equal(parseAigcTlvMessage(officialTlvFixture('tool', { data: [] })), null);
});
