import { createHmac, randomBytes } from 'node:crypto';

const TOKEN_VERSION = '001';
const APP_ID_BYTES = 24;
const DEFAULT_TTL_SECONDS = 15 * 60;
const MAX_UINT32 = 0xffffffff;
const PRIVILEGE_KEYS = [0, 1, 2, 3, 4];

const requireString = (value, name) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
};

const uint32 = (value, name) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_UINT32) {
    throw new RangeError(`${name} must be an unsigned 32-bit integer`);
  }
  return value;
};

const encodeString = (value, name) => {
  const bytes = Buffer.from(requireString(value, name), 'utf8');
  if (bytes.length > 0xffff) {
    throw new RangeError(`${name} must be at most 65535 UTF-8 bytes`);
  }
  const length = Buffer.allocUnsafe(2);
  length.writeUInt16LE(bytes.length);
  return Buffer.concat([length, bytes]);
};

/**
 * Create a short-lived Volcengine RTC room token using the official demo
 * envelope: 001 + 24-byte appId + base64(length-prefixed message and HMAC).
 */
export function createRtcToken({
  appId,
  appKey,
  roomId,
  userId,
  nowSeconds = Math.floor(Date.now() / 1000),
  ttlSeconds = DEFAULT_TTL_SECONDS,
  nonce = randomBytes(4).readUInt32LE(0)
} = {}) {
  requireString(appId, 'appId');
  requireString(appKey, 'appKey');
  requireString(roomId, 'roomId');
  requireString(userId, 'userId');
  if (appId.length !== APP_ID_BYTES || Buffer.byteLength(appId, 'utf8') !== APP_ID_BYTES) {
    throw new RangeError('appId must be exactly 24 characters');
  }
  uint32(nowSeconds, 'nowSeconds');
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new RangeError('ttlSeconds must be a positive integer');
  }
  uint32(nonce, 'nonce');
  const expiresAt = nowSeconds + ttlSeconds;
  uint32(expiresAt, 'nowSeconds + ttlSeconds');

  const fields = [
    (() => { const value = Buffer.allocUnsafe(4); value.writeUInt32LE(nonce); return value; })(),
    (() => { const value = Buffer.allocUnsafe(4); value.writeUInt32LE(nowSeconds); return value; })(),
    (() => { const value = Buffer.allocUnsafe(4); value.writeUInt32LE(expiresAt); return value; })(),
    encodeString(roomId, 'roomId'),
    encodeString(userId, 'userId')
  ];
  const privilegeCount = Buffer.allocUnsafe(2);
  privilegeCount.writeUInt16LE(PRIVILEGE_KEYS.length);
  fields.push(privilegeCount);
  for (const key of PRIVILEGE_KEYS) {
    const privilege = Buffer.allocUnsafe(6);
    privilege.writeUInt16LE(key, 0);
    privilege.writeUInt32LE(expiresAt, 2);
    fields.push(privilege);
  }

  const message = Buffer.concat(fields);
  if (message.length > 0xffff) {
    throw new RangeError('RTC token message is too large');
  }
  const signature = createHmac('sha256', Buffer.from(appKey, 'utf8'))
    .update(message)
    .digest();
  const messageLength = Buffer.allocUnsafe(2);
  messageLength.writeUInt16LE(message.length);
  const signatureLength = Buffer.allocUnsafe(2);
  signatureLength.writeUInt16LE(signature.length);
  const envelope = Buffer.concat([messageLength, message, signatureLength, signature]);
  return TOKEN_VERSION + appId + envelope.toString('base64');
}
