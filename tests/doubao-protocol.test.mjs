import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import {
  EVENTS,
  encodeStartConnection,
  encodeStartSession,
  encodeAudio,
  encodeTextQuery,
  encodeFinishSession,
  decodeServerFrame
} from '../server/doubao-protocol.mjs';

const u32 = value => {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(value);
  return bytes;
};

const serverFrame = ({ event, sessionId = 'session-1', payload, json = true }) => {
  const body = json
    ? gzipSync(Buffer.from(JSON.stringify(payload)))
    : gzipSync(Buffer.from(payload));
  return Buffer.concat([
    Buffer.from([0x11, 0x94, json ? 0x11 : 0x01, 0]),
    u32(event),
    u32(Buffer.byteLength(sessionId)),
    Buffer.from(sessionId),
    u32(body.length),
    body
  ]);
};

test('start connection uses v1 full-request event header', () => {
  const frame = encodeStartConnection();
  assert.deepEqual([...frame.subarray(0, 4)], [0x11, 0x14, 0x11, 0x00]);
  assert.equal(frame.readUInt32BE(4), EVENTS.START_CONNECTION);
});

test('start session contains the session id and compressed JSON options', () => {
  const frame = encodeStartSession('session-1', { dialog: { bot_name: 'JARVIS' } });
  assert.deepEqual([...frame.subarray(0, 4)], [0x11, 0x14, 0x11, 0x00]);
  assert.equal(frame.readUInt32BE(4), EVENTS.START_SESSION);
  assert.equal(frame.readUInt32BE(8), 9);
  assert.equal(frame.subarray(12, 21).toString(), 'session-1');
});

test('audio frame uses no serialization and event 200', () => {
  const frame = encodeAudio('session-1', Buffer.from([1, 2, 3, 4]));
  assert.deepEqual([...frame.subarray(0, 4)], [0x11, 0x24, 0x01, 0x00]);
  assert.equal(frame.readUInt32BE(4), EVENTS.TASK_AUDIO);
});

test('text query uses event 501 with a JSON content payload', () => {
  const frame = encodeTextQuery('session-1', '文字问题');
  assert.equal(frame.readUInt32BE(4), 501);
  assert.equal(frame.subarray(12, 21).toString(), 'session-1');
});

test('finish session emits event 102 for the active session', () => {
  const frame = encodeFinishSession('session-1');
  assert.equal(frame.readUInt32BE(4), EVENTS.FINISH_SESSION);
  assert.equal(frame.subarray(12, 21).toString(), 'session-1');
});

test('decoder returns JSON transcript events', () => {
  const decoded = decodeServerFrame(serverFrame({
    event: EVENTS.ASR_RESPONSE,
    payload: { results: [{ text: '你好' }] }
  }));
  assert.equal(decoded.event, EVENTS.ASR_RESPONSE);
  assert.equal(decoded.sessionId, 'session-1');
  assert.deepEqual(decoded.payload, { results: [{ text: '你好' }] });
});

test('decoder preserves raw PCM response bytes', () => {
  const decoded = decodeServerFrame(serverFrame({
    event: EVENTS.TTS_RESPONSE,
    payload: Buffer.from([1, 2, 3, 4]),
    json: false
  }));
  assert.deepEqual(decoded.payload, Buffer.from([1, 2, 3, 4]));
});

test('decoder maps server error frames', () => {
  const message = gzipSync(Buffer.from(JSON.stringify({ message: 'denied' })));
  const frame = Buffer.concat([
    Buffer.from([0x11, 0xf4, 0x11, 0]),
    u32(45000001),
    u32(message.length),
    message
  ]);
  const decoded = decodeServerFrame(frame);
  assert.equal(decoded.errorCode, 45000001);
  assert.deepEqual(decoded.payload, { message: 'denied' });
});

test('decoder rejects truncated and inconsistent frames', () => {
  assert.throws(() => decodeServerFrame(Buffer.from([0x11, 0x94])), /too short/i);
  const frame = serverFrame({ event: EVENTS.CHAT_RESPONSE, payload: { content: 'hi' } });
  frame.writeUInt32BE(999999, 4 + 4 + 4 + 9);
  assert.throws(() => decodeServerFrame(frame), /payload length/i);
});
