import { createHmac, randomBytes } from 'node:crypto';

const TOKEN_VERSION = '001';
const DEFAULT_TTL_SECONDS = 15 * 60;
const MAX_UINT32 = 0xffffffff;

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

const appendString = (parts, value, name) => {
  const bytes = Buffer.from(requireString(value, name), 'utf8');
  if (bytes.length > 0xffff) {
    throw new RangeError(`${name} must be at most 65535 UTF-8 bytes`);
  }
  const length = Buffer.allocUnsafe(2);
  length.writeUInt16LE(bytes.length);
  parts.push(length, bytes);
};

/**
 * Create a short-lived Volcengine RTC room token.
 *
 * The payload follows the official demo layout: length-prefixed UTF-8 app,
 * room, and user IDs, followed by little-endian nonce, global expiry, and
 * publish/subscribe privilege values. The app key signs the payload only.
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
  uint32(nowSeconds, 'nowSeconds');
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new RangeError('ttlSeconds must be a positive integer');
  }
  uint32(nonce, 'nonce');
  const expiresAt = nowSeconds + ttlSeconds;
  uint32(expiresAt, 'nowSeconds + ttlSeconds');

  const payloadParts = [];
  appendString(payloadParts, appId, 'appId');
  appendString(payloadParts, roomId, 'roomId');
  appendString(payloadParts, userId, 'userId');

  const fields = Buffer.alloc(16);
  fields.writeUInt32LE(nonce, 0);
  fields.writeUInt32LE(expiresAt, 4);
  fields.writeUInt32LE(0, 8);
  fields.writeUInt32LE(4, 12);
  payloadParts.push(fields);

  const payload = Buffer.concat(payloadParts);
  const signature = createHmac('sha256', Buffer.from(appKey, 'utf8'))
    .update(payload)
    .digest();
  return TOKEN_VERSION + Buffer.concat([signature, payload]).toString('base64');
}
