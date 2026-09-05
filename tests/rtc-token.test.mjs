import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createRtcToken } from '../server/rtc-token.mjs';

const input = {
  appId: '0123456789abcdefghijklmn',
  appKey: 'app-key-for-test',
  roomId: 'room-for-test',
  userId: 'user-for-test',
  nowSeconds: 1_700_000_000,
  ttlSeconds: 300,
  nonce: 0x12345678
};

// Independent parser for the official demo wire format. It intentionally
// does not share serialization helpers with server/rtc-token.mjs.
const readString = (message, offset) => {
  const length = message.readUInt16LE(offset);
  offset += 2;
  const end = offset + length;
  return { value: message.subarray(offset, end).toString('utf8'), offset: end };
};

const decodeOfficialToken = (token, appKey) => {
  assert.equal(token.slice(0, 3), '001');
  const appId = token.slice(3, 27);
  assert.equal(appId.length, 24);

  const envelope = Buffer.from(token.slice(27), 'base64');
  const messageLength = envelope.readUInt16LE(0);
  const messageStart = 2;
  const messageEnd = messageStart + messageLength;
  const message = envelope.subarray(messageStart, messageEnd);
  const hmacLength = envelope.readUInt16LE(messageEnd);
  const hmacStart = messageEnd + 2;
  const hmac = envelope.subarray(hmacStart, hmacStart + hmacLength);
  assert.equal(hmacStart + hmacLength, envelope.length);
  assert.equal(hmacLength, 32);
  assert.deepEqual(
    hmac,
    createHmac('sha256', appKey).update(message).digest()
  );

  let offset = 0;
  const nonce = message.readUInt32LE(offset);
  offset += 4;
  const issuedAt = message.readUInt32LE(offset);
  offset += 4;
  const expiresAt = message.readUInt32LE(offset);
  offset += 4;
  const roomId = readString(message, offset);
  offset = roomId.offset;
  const userId = readString(message, offset);
  offset = userId.offset;
  const count = message.readUInt16LE(offset);
  offset += 2;
  const privileges = new Map();
  for (let index = 0; index < count; index += 1) {
    const key = message.readUInt16LE(offset);
    offset += 2;
    const expiry = message.readUInt32LE(offset);
    offset += 4;
    privileges.set(key, expiry);
  }
  assert.equal(offset, message.length);

  return {
    appId,
    nonce,
    issuedAt,
    expiresAt,
    roomId: roomId.value,
    userId: userId.value,
    privileges
  };
};

test('createRtcToken is parseable by the official demo format oracle', () => {
  const decoded = decodeOfficialToken(createRtcToken(input), input.appKey);

  assert.equal(decoded.appId, input.appId);
  assert.equal(decoded.nonce, input.nonce);
  assert.equal(decoded.issuedAt, input.nowSeconds);
  assert.equal(decoded.expiresAt, input.nowSeconds + input.ttlSeconds);
  assert.equal(decoded.roomId, input.roomId);
  assert.equal(decoded.userId, input.userId);
});

test('createRtcToken includes all publish and subscribe privileges with global expiry', () => {
  const decoded = decodeOfficialToken(createRtcToken(input), input.appKey);
  const expectedExpiry = input.nowSeconds + input.ttlSeconds;

  assert.deepEqual([...decoded.privileges.entries()], [
    [0, expectedExpiry],
    [1, expectedExpiry],
    [2, expectedExpiry],
    [3, expectedExpiry],
    [4, expectedExpiry]
  ]);
});

test('createRtcToken rejects an appId that is not exactly 24 characters', () => {
  assert.throws(
    () => createRtcToken({ ...input, appId: 'short-app-id' }),
    /appId.*24/
  );
});
