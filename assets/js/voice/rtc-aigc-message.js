const HEADER_BYTES = 8;
const ACCEPTED_TAGS = new Set(['subv', 'conv']);

function invalidMessage() {
  const error = new Error('Invalid RTC AIGC room message');
  error.code = 'RTC_AIGC_MESSAGE_INVALID';
  return error;
}

function asBytes(message) {
  if (message instanceof ArrayBuffer) return new Uint8Array(message);
  if (ArrayBuffer.isView(message)) {
    return new Uint8Array(message.buffer, message.byteOffset, message.byteLength);
  }
  throw invalidMessage();
}

export function parseAigcTlvMessage(message) {
  const bytes = asBytes(message);
  if (bytes.byteLength < HEADER_BYTES) throw invalidMessage();

  const tag = String.fromCharCode(...bytes.subarray(0, 4));
  const valueLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, false);
  if (valueLength !== bytes.byteLength - HEADER_BYTES) throw invalidMessage();
  if (!ACCEPTED_TAGS.has(tag)) return null;

  try {
    const value = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(HEADER_BYTES));
    const payload = JSON.parse(value);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw invalidMessage();
    return { tag, payload };
  } catch (error) {
    if (error?.code === 'RTC_AIGC_MESSAGE_INVALID') throw error;
    throw invalidMessage();
  }
}
