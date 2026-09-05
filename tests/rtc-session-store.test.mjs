import test from 'node:test';
import assert from 'node:assert/strict';
import { createRtcSessionStore } from '../server/rtc-session-store.mjs';

function setup(stopVoiceChat) {
  const timers = new Map();
  let nextId = 0;
  let store;
  store = createRtcSessionStore({
    config: { rtc: { appId: 'test' }, sessionTtlMs: 900000, maxConnectionsPerIp: 1 },
    tokenFactory: () => 'test-token',
    setTimeoutFn: (callback, delay) => { const id = ++nextId; timers.set(id, { callback, delay }); return id; },
    clearTimeoutFn: id => timers.delete(id),
    onExpire: id => store.stop(id, stopVoiceChat)
  });
  const fire = async () => {
    const [id, timer] = timers.entries().next().value || [];
    assert.ok(timer, 'server owns a pending cleanup timer');
    timers.delete(id);
    await timer.callback();
  };
  return { store, timers, fire };
}

test('lost start response retains identifiers and automatically compensates without DELETE', async () => {
  let stopped;
  const { store, fire, timers } = setup(async session => { stopped = session.taskId; });
  const session = store.create('visitor');
  let remoteTask;
  await assert.rejects(store.start(session.sessionId, async value => {
    remoteTask = value.taskId;
    throw new Error('response lost after task creation');
  }));
  assert.equal(store.create('visitor'), null);
  await fire();
  assert.equal(stopped, remoteTask);
  assert.deepEqual(store.sessionIds(), []);
  assert.equal(timers.size, 0);
  assert.ok(store.create('visitor'));
});

test('failed expiry automatically retries stop and only then releases quota', async () => {
  let attempts = 0;
  const { store, timers, fire } = setup(async () => {
    if (++attempts === 1) throw new Error('temporary stop failure');
  });
  const session = store.create('visitor');
  await store.start(session.sessionId, async () => {});
  await fire();
  assert.equal(store.create('visitor'), null);
  assert.equal(timers.size, 1);
  assert.equal([...timers.values()][0].delay, 1000);
  await fire();
  assert.equal(attempts, 2);
  assert.equal(timers.size, 0);
  assert.ok(store.create('visitor'));
});

test('failed DELETE stays terminal, shares in-flight stop, and retries at low frequency', async () => {
  let attempts = 0;
  const stop = async () => { attempts += 1; throw new Error('unavailable'); };
  const { store, timers, fire } = setup(stop);
  const session = store.create('visitor');
  await store.start(session.sessionId, async () => {});
  await Promise.allSettled([store.stop(session.sessionId, stop), store.stop(session.sessionId, stop)]);
  assert.equal(attempts, 1);
  let restarted = false;
  assert.equal(await store.start(session.sessionId, async () => { restarted = true; }), null);
  assert.equal(restarted, false);
  for (const delay of [1000, 2000, 5000, 30000, 300000, 300000]) {
    assert.equal(timers.size, 1);
    assert.equal([...timers.values()][0].delay, delay);
    await fire();
  }
  assert.equal(store.create('visitor'), null);
  await store.stop(session.sessionId, async () => {});
  assert.equal(timers.size, 0);
});
