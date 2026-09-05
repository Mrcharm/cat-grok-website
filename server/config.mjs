const required = (env, name) => {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const positiveInteger = (env, name, fallback) => {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Invalid positive integer environment variable: ${name}`);
  }
  return value;
};

const atMostTwo = (env, name) => Math.min(positiveInteger(env, name, 2), 2);

const DOUBAO_REALTIME_URL = 'wss://openspeech.bytedance.com/api/v3/duplex/realtime/dialogue';

export function loadVoiceConfig(env = process.env) {
  const allowedOrigins = required(env, 'ALLOWED_ORIGINS')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  if (allowedOrigins.length === 0) {
    throw new Error('Missing required environment variable: ALLOWED_ORIGINS');
  }

  return {
    apiKey: required(env, 'DOUBAO_API_KEY'),
    allowedOrigins,
    upstreamUrl: DOUBAO_REALTIME_URL,
    sessionTtlMs: Math.min(positiveInteger(env, 'VOICE_SESSION_TTL_MS', 900000), 900000),
    maxConnections: atMostTwo(env, 'VOICE_MAX_CONNECTIONS')
  };
}

export function loadRtcConfig(env = process.env) {
  const allowedOrigins = required(env, 'ALLOWED_ORIGINS')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  if (allowedOrigins.length === 0) {
    throw new Error('Missing required environment variable: ALLOWED_ORIGINS');
  }

  return {
    rtc: {
      appId: required(env, 'RTC_APP_ID'),
      appKey: required(env, 'RTC_APP_KEY')
    },
    iam: {
      accessKeyId: required(env, 'VOLC_ACCESS_KEY_ID'),
      secretAccessKey: required(env, 'VOLC_SECRET_ACCESS_KEY')
    },
    s2s: {
      appId: required(env, 'S2S_APP_ID'),
      accessToken: required(env, 'S2S_ACCESS_TOKEN')
    },
    allowedOrigins,
    clientIp: {
      mode: env.RENDER === 'true' ? 'trusted-proxy' : 'direct',
      trustedProxyCidrs: (env.RTC_TRUSTED_PROXY_CIDRS || '').split(',').map(value => value.trim()).filter(Boolean)
    },
    sessionTtlMs: Math.min(
      positiveInteger(env, 'RTC_SESSION_TTL_MS', 900000),
      900000
    ),
    maxConnectionsPerIp: atMostTwo(env, 'MAX_CONNECTIONS_PER_IP')
  };
}

export function isAllowedOrigin(origin, allowedOrigins) {
  return typeof origin === 'string' && allowedOrigins.includes(origin);
}
