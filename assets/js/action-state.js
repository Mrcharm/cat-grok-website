const freshState = () => ({ version: 2, tasks: {} });

const normalizeValue = (id, value, tasks) => {
  const task = tasks.find(item => item.id === id);
  if (!task) throw new Error('unknown task: ' + id);
  if (!Array.isArray(value.checks) || value.checks.length !== task.steps.length) {
    throw new Error('invalid checks for ' + id);
  }
  return {
    checks: value.checks.map(Boolean),
    evidence: String(value.evidence || ''),
    review: String(value.review || ''),
    done: Boolean(value.done)
  };
};

function validateImportedState(json, ids, tasks) {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json;
  if (parsed?.version !== 2 || !parsed.tasks || typeof parsed.tasks !== 'object') {
    throw new Error('invalid state version or tasks');
  }
  const normalized = {};
  for (const [id, value] of Object.entries(parsed.tasks)) {
    if (!ids.has(id)) throw new Error('unknown task: ' + id);
    normalized[id] = normalizeValue(id, value, tasks);
  }
  return { version: 2, tasks: normalized };
}

function migrateLegacyState(raw, ids, tasks) {
  const parsed = JSON.parse(raw);
  if (!parsed?.tasks || typeof parsed.tasks !== 'object') {
    throw new Error('invalid legacy state');
  }
  const migrated = freshState();
  for (const [legacyId, value] of Object.entries(parsed.tasks)) {
    const id = 'd' + String(legacyId).padStart(2, '0');
    if (!ids.has(id)) continue;
    const task = tasks.find(item => item.id === id);
    migrated.tasks[id] = normalizeValue(id, {
      checks: Array.isArray(value.checks)
        ? task.steps.map((_, index) => Boolean(value.checks[index]))
        : task.steps.map(() => false),
      evidence: value.evidence,
      review: value.review,
      done: value.done
    }, tasks);
  }
  return migrated;
}

function readState(storage, key, legacyKey, ids, tasks) {
  let raw = null;
  try {
    raw = storage.getItem(key);
    if (raw) {
      return {
        state: validateImportedState(raw, ids, tasks),
        corruptRaw: null
      };
    }
    const legacyRaw = legacyKey ? storage.getItem(legacyKey) : null;
    if (!legacyRaw) return { state: freshState(), corruptRaw: null };
    const state = migrateLegacyState(legacyRaw, ids, tasks);
    storage.setItem(key, JSON.stringify(state));
    storage.removeItem(legacyKey);
    return { state, corruptRaw: null };
  } catch {
    return { state: freshState(), corruptRaw: raw };
  }
}

export function createActionStore({
  storage,
  key = 'mrcharm-growth-state-v2',
  legacyKey = 'mrcharm-growth-state-v1',
  tasks
}) {
  const ids = new Set(tasks.map(task => task.id));
  const empty = task => ({
    checks: task.steps.map(() => false),
    evidence: '',
    review: '',
    done: false
  });
  let { state, corruptRaw } = readState(storage, key, legacyKey, ids, tasks);

  const persist = () => storage.setItem(key, JSON.stringify(state));

  return {
    getTaskState(id) {
      const task = tasks.find(item => item.id === id);
      if (!task) throw new Error('unknown task: ' + id);
      return state.tasks[id] || empty(task);
    },

    saveTask(id, value) {
      if (!ids.has(id)) throw new Error('unknown task: ' + id);
      state.tasks[id] = normalizeValue(id, value, tasks);
      persist();
    },

    completeTask(id, value) {
      if (!value.checks.every(Boolean) || !String(value.evidence || '').trim()) {
        throw new Error('complete all steps and add evidence');
      }
      this.saveTask(id, { ...value, done: true });
    },

    getFocusTask(date) {
      return tasks.find(task => (
        task.date === date && !this.getTaskState(task.id).done
      )) || tasks.find(task => !this.getTaskState(task.id).done) || null;
    },

    classifyTasks() {
      const next = [];
      const doing = [];
      const complete = [];
      for (const task of tasks) {
        const value = this.getTaskState(task.id);
        if (value.done) complete.push(task);
        else if (value.checks.some(Boolean) || value.evidence || value.review) doing.push(task);
        else next.push(task);
      }
      return { next, doing, complete };
    },

    exportState() {
      return JSON.stringify(state, null, 2);
    },

    importState(json) {
      state = validateImportedState(json, ids, tasks);
      corruptRaw = null;
      persist();
    },

    resetState() {
      state = freshState();
      corruptRaw = null;
      storage.removeItem(key);
    },

    getRecoveryPayload() {
      return corruptRaw;
    }
  };
}
