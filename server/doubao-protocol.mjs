import { gzipSync, gunzipSync } from 'node:zlib';

export const EVENTS = Object.freeze({
  START_CONNECTION: 1,
  CONNECTION_STARTED: 50,
  START_SESSION: 100,
  FINISH_SESSION: 102,
  SESSION_STARTED: 150,
  TASK_AUDIO: 200,
  TTS_SENTENCE_START: 350,
  TTS_SENTENCE_END: 351,
  TTS_RESPONSE: 352,
  TTS_ENDED: 359,
  ASR_INFO: 450,
  ASR_RESPONSE: 451,
  ASR_ENDED: 459,
  USAGE_RESPONSE: 154,
  CHAT_RESPONSE: 550,
  CHAT_ENDED: 559,
  CHAT_TEXT_QUERY: 501
});

const MESSAGE = Object.freeze({
  CLIENT_FULL: 0x1,
  CLIENT_AUDIO: 0x2,
  SERVER_FULL: 0x9,
  SERVER_ACK: 0xb,
  SERVER_ERROR: 0xf
});

const SERIALIZATION = Object.freeze({ NONE: 0, JSON: 1 });
const COMPRESSION = Object.freeze({ NONE: 0, GZIP: 1 });
const FLAG_WITH_EVENT = 0x4;
const FLAG_WITH_SEQUENCE = 0x2;

const u32 = value => {
  const bytes = Buffer.allocUnsafe(4);
  bytes.writeUInt32BE(value);
  return bytes;
};

const makeHeader = ({
  type = MESSAGE.CLIENT_FULL,
  flags = FLAG_WITH_EVENT,
  serialization = SERIALIZATION.JSON,
  compression = COMPRESSION.GZIP
} = {}) => Buffer.from([
  0x11,
  (type << 4) | flags,
  (serialization << 4) | compression,
  0x00
]);

const encodeRequest = ({ event, sessionId, payload = {}, audio = false }) => {
  const payloadBytes = audio ? Buffer.from(payload) : Buffer.from(JSON.stringify(payload));
  const compressed = gzipSync(payloadBytes);
  const parts = [
    makeHeader({
      type: audio ? MESSAGE.CLIENT_AUDIO : MESSAGE.CLIENT_FULL,
      serialization: audio ? SERIALIZATION.NONE : SERIALIZATION.JSON
    }),
    u32(event)
  ];

  if (sessionId !== undefined) {
    const session = Buffer.from(sessionId);
    parts.push(u32(session.length), session);
  }
  parts.push(u32(compressed.length), compressed);
  return Buffer.concat(parts);
};

export const encodeStartConnection = () => encodeRequest({
  event: EVENTS.START_CONNECTION,
  payload: {}
});

export const encodeStartSession = (sessionId, options) => encodeRequest({
  event: EVENTS.START_SESSION,
  sessionId,
  payload: options
});

export const encodeAudio = (sessionId, pcm) => encodeRequest({
  event: EVENTS.TASK_AUDIO,
  sessionId,
  payload: pcm,
  audio: true
});

export const encodeTextQuery = (sessionId, content) => encodeRequest({
  event: EVENTS.CHAT_TEXT_QUERY,
  sessionId,
  payload: { content }
});

export const encodeFinishSession = sessionId => encodeRequest({
  event: EVENTS.FINISH_SESSION,
  sessionId,
  payload: {}
});

const readU32 = (buffer, offset, label) => {
  if (offset + 4 > buffer.length) throw new Error(`Frame too short for ${label}`);
  return buffer.readUInt32BE(offset);
};

export function decodeServerFrame(input) {
  const frame = Buffer.from(input);
  if (frame.length < 4) throw new Error('Response frame too short');

  const headerBytes = (frame[0] & 0x0f) * 4;
  if (headerBytes < 4 || headerBytes > frame.length) {
    throw new Error('Response frame has invalid header length');
  }

  const messageType = frame[1] >> 4;
  const flags = frame[1] & 0x0f;
  const serialization = frame[2] >> 4;
  const compression = frame[2] & 0x0f;
  let offset = headerBytes;
  let event;
  let sessionId;
  let errorCode;

  if (messageType === MESSAGE.SERVER_ERROR) {
    errorCode = readU32(frame, offset, 'error code');
    offset += 4;
  } else if (messageType === MESSAGE.SERVER_FULL || messageType === MESSAGE.SERVER_ACK) {
    if (flags & FLAG_WITH_SEQUENCE) offset += 4;
    if (flags & FLAG_WITH_EVENT) {
      event = readU32(frame, offset, 'event');
      offset += 4;
    }
    const sessionLength = readU32(frame, offset, 'session id length');
    offset += 4;
    if (offset + sessionLength > frame.length) throw new Error('Invalid session id length');
    sessionId = frame.subarray(offset, offset + sessionLength).toString('utf8');
    offset += sessionLength;
  } else {
    throw new Error(`Unsupported server message type: ${messageType}`);
  }

  const payloadLength = readU32(frame, offset, 'payload length');
  offset += 4;
  if (offset + payloadLength !== frame.length) {
    throw new Error('Invalid payload length');
  }

  let payload = frame.subarray(offset, offset + payloadLength);
  if (compression === COMPRESSION.GZIP) payload = gunzipSync(payload);
  if (serialization === SERIALIZATION.JSON) {
    payload = JSON.parse(payload.toString('utf8'));
  } else if (serialization !== SERIALIZATION.NONE) {
    throw new Error(`Unsupported payload serialization: ${serialization}`);
  }

  return { event, sessionId, payload, errorCode };
}
