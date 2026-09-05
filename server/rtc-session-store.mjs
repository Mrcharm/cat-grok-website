import { randomUUID } from 'node:crypto';
import { createRtcToken } from './rtc-token.mjs';

const MAX_SESSIONS_PER_IP = 2;

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
  if (!Number.isSafeInteger(config.maxConnectionsPerIp) || config.maxConnectionsPerIp <= 0) {
    throw new RangeError('maxConnectionsPerIp must be a positive integer');
  }
  const maxConnectionsPerIp = Math.min(config.maxConnectionsPerIp, MAX_SESSIONS_PER_IP);
  const sessions = new Map();
  const sessionIdsByIp = new Map();

  const remove = session => {
    sessions.delete(session.sessionId);
    const ids = sessionIdsByIp.get(session.ip);
    if (!ids) return;
    ids.delete(session.sessionId);
    if (ids.size === 0) sessionIdsByIp.delete(session.ip);
    clearTimeoutFn(session.timer);
  };

  const expire = sessionId => Promise.resolve(onExpire(sessionId)).catch(() => {});

  return {
    create(ip) {
      const active = sessionIdsByIp.get(ip);
      if (active?.size >= maxConnectionsPerIp) return null;

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
        startedRemotely: false,
        startPromise: null,
        stopPromise: null,
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
      if (session.stopPromise) {
        await session.stopPromise.catch(() => {});
        return sessions.get(sessionId) || null;
      }
      if (session.startPromise) return session.startPromise;

      session.state = 'starting';
      session.startPromise = (async () => {
        try {
          await startVoiceChat(session);
          session.startedRemotely = true;
          if (!session.stopPromise) session.state = 'started';
          return session;
        } catch (error) {
          if (!session.stopPromise) session.state = 'prepared';
          throw error;
        } finally {
          session.startPromise = null;
        }
      })();
      return session.startPromise;
    },

    async stop(sessionId, stopVoiceChat) {
      const session = sessions.get(sessionId);
      if (!session) return null;
      if (session.stopPromise) return session.stopPromise;

      session.state = 'stopping';
      const shared = (async () => {
        try {
          await session.startPromise;
        } catch {
          // A failed start has no remote task to stop.
        }
        if (session.startedRemotely) await stopVoiceChat(session);
        remove(session);
      })();
      session.stopPromise = shared;
      try {
        await shared;
      } catch (error) {
        session.state = session.startedRemotely ? 'started' : 'prepared';
        throw error;
      } finally {
        if (session.stopPromise === shared) session.stopPromise = null;
      }
      return session;
    },

    sessionIds() {
      return [...sessions.keys()];
    }
  };
}
