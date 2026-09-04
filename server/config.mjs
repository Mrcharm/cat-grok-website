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

export function loadConfig(env = process.env) {
  return {
    port: positiveInteger(env, 'PORT', 8787),
    doubaoWsUrl: required(env, 'DOUBAO_WS_URL'),
    appId: required(env, 'DOUBAO_APP_ID'),
    accessKey: required(env, 'DOUBAO_ACCESS_KEY'),
    modelName: required(env, 'DOUBAO_MODEL_NAME'),
    speaker: env.DOUBAO_SPEAKER?.trim() || 'zh_female_vv_jupiter_bigtts',
    allowedOrigins: required(env, 'ALLOWED_ORIGINS')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean),
    maxSessionMs: positiveInteger(env, 'MAX_SESSION_MS', 15 * 60 * 1000),
    maxConnectionsPerIp: positiveInteger(env, 'MAX_CONNECTIONS_PER_IP', 2)
  };
}

export function isAllowedOrigin(origin, allowedOrigins) {
  return typeof origin === 'string' && allowedOrigins.includes(origin);
}
