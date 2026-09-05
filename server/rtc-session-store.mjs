import { randomUUID } from 'node:crypto';
import { createRtcToken } from './rtc-token.mjs';

const publicFields = ({ sessionId, appId, roomId, userId, botUserId, taskId, token, expiresAt }) => ({
  sessionId,
  appId,
  roomId,
  userId,
  botUserId,
  taskId,
  token,
  expiresAt
});

const opaqueId = prefix => `${prefix}${randomUUID()}`;

export function createRtcSessionStore({
  config,
  tokenFactory = createRtcToken,
  now = () => Date.now(),
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  onExpire = () => {}
}) {
  const sessions = new Map();
  const sessionIdsByIp = new Map();

  const removeIpSession = session => {
    const ids = sessionIdsByIp.get(session.ip);
    if (!ids) return;
    ids.delete(session.sessionId);
    if (ids.size === 0) sessionIdsByIp.delete(session.ip);
  };

  const expire = sessionId => Promise.resolve(onExpire(sessionId)).catch(() => {});

  return {
    create(ip) {
      const active = sessionIdsByIp.get(ip);
      if (active?.size >= config.maxConnectionsPerIp) return null;

      const issuedAt = now();
      const expiresAtMs = issuedAt + config.sessionTtlMs;
      const roomId = opaqueId('room_');
      const userId = opaqueId('user_');
      const session = {
        sessionId: opaqueId('session_'),
        ip,
        appId: config.rtc.appId,
        roomId,
        userId,
        botUserId: opaqueId('bot_'),
        taskId: opaqueId('task_'),
        token: tokenFactory({
          appId: config.rtc.appId,
          appKey: config.rtc.appKey,
          roomId,
          userId,
          nowSeconds: Math.floor(issuedAt / 1000),
          ttlSeconds: Math.ceil(config.sessionTtlMs / 1000)
        }),
        expiresAt: new Date(expiresAtMs).toISOString(),
        state: 'prepared',
        startPromise: null,
        timer: null
      };
      session.timer = setTimeoutFn(() => expire(session.sessionId), config.sessionTtlMs);
      sessions.set(session.sessionId, session);
      if (active) active.add(session.sessionId);
      else sessionIdsByIp.set(ip, new Set([session.sessionId]));
      return session;
    },

    public(session) {
      return publicFields(session);
    },

    async start(sessionId, startVoiceChat) {
      const session = sessions.get(sessionId);
      if (!session) return null;
      if (session.state === 'started') return session;
      if (session.startPromise) return session.startPromise;

      session.state = 'starting';
      session.startPromise = (async () => {
        try {
          await startVoiceChat(session);
          session.state = 'started';
          return session;
        } catch (error) {
          session.state = 'prepared';
          throw error;
        } finally {
          session.startPromise = null;
        }
      })();
      return session.startPromise;
    },

    take(sessionId) {
      const session = sessions.get(sessionId);
      if (!session) return null;
      sessions.delete(sessionId);
      removeIpSession(session);
      clearTimeoutFn(session.timer);
      return session;
    },

    takeAll() {
      return [...sessions.keys()].map(sessionId => this.take(sessionId)).filter(Boolean);
    }
  };
}
