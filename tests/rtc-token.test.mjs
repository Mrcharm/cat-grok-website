import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createRtcToken } from '../server/rtc-token.mjs';

const input = {
  appId: 'app-id-for-test',
  appKey: 'app-key-for-test',
  roomId: 'room-for-test',
  userId: 'user-for-test',
  nowSeconds: 1_700_000_000,
  ttlSeconds: 300,
  nonce: 0x12345678
};

const readString = (payload, offset) => {
  const length = payload.readUInt16LE(offset);
  offset += 2;
  const value = payload.subarray(offset, offset + length).toString('utf8');
  return { value, offset: offset + length };
};

const decodeToken = token => {
  assert.equal(token.slice(0, 3), '001');
  const encoded = token.slice(3);
  const decoded = Buffer.from(encoded, 'base64');
  const signature = decoded.subarray(0, 32);
  const payload = decoded.subarray(32);
  let offset = 0;
  const appId = readString(payload, offset);
  offset = appId.offset;
  const roomId = readString(payload, offset);
  offset = roomId.offset;
  const userId = readString(payload, offset);
  offset = userId.offset;
  const nonce = payload.readUInt32LE(offset);
  offset += 4;
  const expiresAt = payload.readUInt32LE(offset);
  offset += 4;
  const publishPrivilege = payload.readUInt32LE(offset);
  offset += 4;
  const subscribePrivilege = payload.readUInt32LE(offset);
  offset += 4;
  assert.equal(offset, payload.length);
  return {
    signature,
    payload,
    appId: appId.value,
    roomId: roomId.value,
    userId: userId.value,
    nonce,
    expiresAt,
    publishPrivilege,
    subscribePrivilege
  };
};

test('createRtcToken emits the official version and binds room/user with global expiry', () => {
  const token = createRtcToken(input);
  const decoded = decodeToken(token);

  assert.equal(decoded.appId, input.appId);
  assert.equal(decoded.roomId, input.roomId);
  assert.equal(decoded.userId, input.userId);
  assert.equal(decoded.nonce, input.nonce);
  assert.equal(decoded.expiresAt, input.nowSeconds + input.ttlSeconds);
});
test('createRtcToken grants publish privilege 0 and subscribe privilege 4', () => {
  const decoded = decodeToken(createRtcToken(input));

  assert.equal(decoded.publishPrivilege, 0);
  assert.equal(decoded.subscribePrivilege, 4);
});

test('createRtcToken signs the exact little-endian payload with HMAC-SHA256', () => {
  const decoded = decodeToken(createRtcToken(input));
  const expected = createHmac('sha256', input.appKey).update(decoded.payload).digest();

  assert.deepEqual(decoded.signature, expected);
});
