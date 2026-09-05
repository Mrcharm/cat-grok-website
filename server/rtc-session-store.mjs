import { randomUUID } from 'node:crypto';
import { createRtcToken } from './rtc-token.mjs';

const MAX_SESSIONS_PER_IP = 2;
const CLEANUP_DELAYS_MS = [1000, 2000, 5000, 30000, 300000];

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
    clearTimeoutFn(session.timer);
    session.timer = null;
    sessions.delete(session.sessionId);
    const ids = sessionIdsByIp.get(session.ip);
    if (!ids) return;
    ids.delete(session.sessionId);
    if (ids.size === 0) sessionIdsByIp.delete(session.ip);
  };

  const scheduleCleanup = (session, delay) => {
    clearTimeoutFn(session.timer);
    session.timer = setTimeoutFn(async () => {
      session.timer = null;
      if (!sessions.has(session.sessionId)) return;
      try {
        await onExpire(session.sessionId);
      } catch {
        // stop() retains identifiers/quota and owns the next retry timer.
      }
    }, delay);
    session.timer?.unref?.();
  };

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
        startAttempted: false,
        cleanupPending: false,
        cleanupAttempts: 0,
        startPromise: null,
        stopPromise: null,
        timer: null
      };
      scheduleCleanup(session, config.sessionTtlMs);
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
      if (session.cleanupPending) return null;
      if (session.state === 'started') return session;
      if (session.stopPromise) {
        await session.stopPromise.catch(() => {});
        return sessions.get(sessionId) || null;
      }
      if (session.startPromise) return session.startPromise;

      session.state = 'starting';
      session.startAttempted = true;
      session.startPromise = Promise.resolve().then(async () => {
        try {
          await startVoiceChat(session);
          session.startedRemotely = true;
          if (!session.cleanupPending) session.state = 'started';
          return session;
        } catch (error) {
          session.cleanupPending = true;
          session.state = 'cleanup-pending';
          if (!session.stopPromise) scheduleCleanup(session, 0);
          throw error;
        } finally {
          session.startPromise = null;
        }
      });
      return session.startPromise;
    },

    async stop(sessionId, stopVoiceChat) {
      const session = sessions.get(sessionId);
      if (!session) return null;
      if (session.stopPromise) return session.stopPromise;

      session.cleanupPending = true;
      clearTimeoutFn(session.timer);
      session.timer = null;
      session.state = 'stopping';
      const shared = Promise.resolve().then(async () => {
        try {
          await session.startPromise;
        } catch {
          // Lost start responses are uncertain: compensate with the same IDs.
        }
        if (session.startAttempted) await stopVoiceChat(session);
        remove(session);
      });
      session.stopPromise = shared;
      try {
        await shared;
      } catch (error) {
        session.state = 'cleanup-pending';
        const index = Math.min(session.cleanupAttempts++, CLEANUP_DELAYS_MS.length - 1);
        scheduleCleanup(session, CLEANUP_DELAYS_MS[index]);
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
