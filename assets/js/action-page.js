import { createActionStore } from './action-state.js';

const pad = value => String(value).padStart(2, '0');

export function localDateISO(date = new Date()) {
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}

export function buildMonthCells(year, month, tasks, todayIso, doneIds = new Set()) {
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const taskByDate = new Map(tasks.map(task => [task.date, task]));
  const cells = Array.from({ length: firstWeekday }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = year + '-' + pad(month + 1) + '-' + pad(day);
    const task = taskByDate.get(iso) || null;
    cells.push({
      day,
      iso,
      task,
      today: iso === todayIso,
      done: Boolean(task && doneIds.has(task.id))
    });
  }

  while (cells.length % 7) cells.push(null);
  return cells;
}

const parsePageTasks = root => {
  const data = root.querySelector('#action-data');
  if (!data) return [];
  try {
    return JSON.parse(data.textContent || '[]');
  } catch {
    return [];
  }
};

const assetLabels = {
  influence: '行业影响力',
  technical: 'AI 系统能力',
  income: '第二收入与投资系统',
  life: '生活底盘'
};

export function initActionPage(root = document, options = {}) {
  const tasks = options.tasks || parsePageTasks(root);
  if (!tasks.length) return null;

  const storage = options.storage || globalThis.localStorage;
  const now = options.now || new Date();
  const todayIso = localDateISO(now);
  const store = createActionStore({ storage, tasks });
  const byId = id => root.querySelector('#' + id);
  const dialog = byId('task-dialog');
  let activeTask = null;
  let lastTrigger = null;
  let timerId = null;
  let secondsLeft = 30 * 60;
  const initialFocus = store.getFocusTask(todayIso) || tasks[0];
  const initialMonth = new Date(initialFocus.date + 'T12:00:00');
  let calendarYear = initialMonth.getFullYear();
  let calendarMonth = initialMonth.getMonth();

  const toast = message => {
    const element = byId('action-toast');
    element.textContent = message;
    element.dataset.visible = 'true';
    globalThis.setTimeout(() => { element.dataset.visible = 'false'; }, 2600);
  };

  const showStorageWarning = message => {
    const warning = byId('storage-warning');
    warning.hidden = false;
    warning.textContent = message;
  };

  const readForm = () => ({
    checks: [...byId('task-checklist').querySelectorAll('input[type="checkbox"]')]
      .map(input => input.checked),
    evidence: byId('evidence').value,
    review: byId('review').value,
    done: activeTask ? store.getTaskState(activeTask.id).done : false
  });

  const renderTimer = () => {
    byId('timer-display').textContent = pad(Math.floor(secondsLeft / 60)) + ':' + pad(secondsLeft % 60);
    byId('timer-button').textContent = timerId ? '暂停计时' : (secondsLeft < 1800 ? '继续专注' : '开始 30 分钟');
  };

  const stopTimer = () => {
    if (timerId) globalThis.clearInterval(timerId);
    timerId = null;
    renderTimer();
  };

  const renderProgress = () => {
    const complete = tasks.filter(task => store.getTaskState(task.id).done).length;
    byId('done-count').textContent = complete;
    byId('progress-bar').style.width = Math.round((complete / tasks.length) * 100) + '%';
    const progress = byId('progress-bar').parentElement;
    progress.setAttribute('aria-valuenow', String(complete));
    byId('progress-text').textContent = complete === tasks.length
      ? '30 天证据已集齐。请做月度验收，并选择下月唯一主攻方向。'
      : '还剩 ' + (tasks.length - complete) + ' 个证据，不补作业，只继续下一步。';
  };

  const renderToday = () => {
    const focus = store.getFocusTask(todayIso);
    const button = byId('open-today');
    if (!focus) {
      byId('today-date').textContent = '本轮行动已完成';
      byId('today-code').textContent = 'REVIEW';
      byId('today-title').textContent = '进行月度验收';
      byId('today-deliverable').textContent = '回看四类资产的证据，只选择下月一个主攻方向。';
      button.hidden = true;
      return;
    }
    byId('today-date').textContent = focus.date === todayIso ? '今天 · ' + focus.date : '当前下一步 · ' + focus.date;
    byId('today-code').textContent = focus.id.toUpperCase();
    byId('today-title').textContent = focus.title;
    byId('today-deliverable').textContent = focus.deliverable;
    button.hidden = false;
    button.dataset.taskId = focus.id;
  };

  const taskButton = (task, className = '') => {
    const button = root.createElement('button');
    button.type = 'button';
    button.className = 'task-card ' + className;
    button.dataset.taskId = task.id;
    button.innerHTML = '<small>' + task.id.toUpperCase() + ' · ' + task.date.slice(5) + ' · ' +
      (assetLabels[task.asset] || task.asset) + '</small><strong></strong><span></span>';
    button.querySelector('strong').textContent = task.title;
    button.querySelector('span').textContent = task.deliverable;
    return button;
  };

  const renderKanban = () => {
    const groups = store.classifyTasks();
    for (const name of ['next', 'doing', 'complete']) {
      const container = byId('kanban-' + name);
      container.replaceChildren(...groups[name].map(task => taskButton(task, name)));
      byId('kanban-' + name + '-count').textContent = groups[name].length;
      if (!groups[name].length) {
        const empty = root.createElement('p');
        empty.className = 'kanban-empty';
        empty.textContent = name === 'complete' ? '完成后，证据会出现在这里。' : '目前没有任务。';
        container.append(empty);
      }
    }
  };

  const renderCalendar = () => {
    const done = new Set(tasks.filter(task => store.getTaskState(task.id).done).map(task => task.id));
    const cells = buildMonthCells(calendarYear, calendarMonth, tasks, todayIso, done);
    byId('calendar-month').textContent = calendarYear + ' 年 ' + (calendarMonth + 1) + ' 月';
    const monthTasks = tasks.filter(task => task.date.startsWith(calendarYear + '-' + pad(calendarMonth + 1)));
    byId('calendar-summary').textContent = monthTasks.length
      ? '本月 ' + monthTasks.length + ' 项，已完成 ' + monthTasks.filter(task => done.has(task.id)).length + ' 项'
      : '这个月没有安排固定任务';
    const elements = cells.map(cell => {
      if (!cell) {
        const blank = root.createElement('span');
        blank.className = 'calendar-day is-empty';
        return blank;
      }
      const element = root.createElement(cell.task ? 'button' : 'span');
      if (cell.task) element.type = 'button';
      element.className = 'calendar-day' + (cell.today ? ' is-today' : '') +
        (cell.done ? ' is-done' : '') + (cell.task ? ' has-task' : '');
      element.innerHTML = '<b>' + cell.day + '</b>';
      if (cell.task) {
        element.dataset.taskId = cell.task.id;
        const title = root.createElement('span');
        title.textContent = cell.task.title;
        element.append(title);
        element.setAttribute('aria-label', cell.task.date + ' ' + cell.task.title + (cell.done ? '，已完成' : ''));
      }
      return element;
    });
    byId('calendar-grid').replaceChildren(...elements);
  };

  const renderAll = () => {
    renderToday();
    renderProgress();
    renderCalendar();
    renderKanban();
  };

  const openTask = (task, trigger) => {
    activeTask = task;
    lastTrigger = trigger || root.activeElement;
    const value = store.getTaskState(task.id);
    byId('dialog-meta').textContent = task.date + ' · ' + task.id.toUpperCase() + ' · ' + (assetLabels[task.asset] || task.asset);
    byId('dialog-title').textContent = task.title;
    byId('task-deliverable').textContent = task.deliverable;
    byId('task-why').textContent = task.why;
    byId('task-method').textContent = task.method;
    byId('task-completion').textContent = task.completion;
    byId('task-resources').replaceChildren(...task.resources.map(resource => {
      const link = root.createElement('a');
      link.href = resource.url;
      link.target = resource.url.startsWith('http') ? '_blank' : '_self';
      if (link.target === '_blank') link.rel = 'noopener noreferrer';
      link.textContent = resource.label + ' ↗';
      return link;
    }));
    byId('task-checklist').replaceChildren(...task.steps.map((step, index) => {
      const label = root.createElement('label');
      const input = root.createElement('input');
      input.type = 'checkbox';
      input.checked = Boolean(value.checks[index]);
      const text = root.createElement('span');
      text.textContent = step;
      label.append(input, text);
      return label;
    }));
    byId('evidence').value = value.evidence;
    byId('review').value = value.review;
    byId('complete-task').textContent = value.done ? '已完成 · 更新记录' : '验收并完成';
    secondsLeft = 30 * 60;
    stopTimer();
    dialog.showModal();
  };

  root.addEventListener('click', event => {
    const trigger = event.target.closest('[data-task-id]');
    if (!trigger) return;
    const task = tasks.find(item => item.id === trigger.dataset.taskId);
    if (task) openTask(task, trigger);
  });

  byId('dialog-close').addEventListener('click', stopTimer);
  dialog.addEventListener('close', () => {
    stopTimer();
    lastTrigger?.focus?.();
  });

  byId('timer-button').addEventListener('click', () => {
    if (timerId) {
      stopTimer();
      return;
    }
    if (secondsLeft <= 0) secondsLeft = 30 * 60;
    timerId = globalThis.setInterval(() => {
      secondsLeft -= 1;
      renderTimer();
      if (secondsLeft <= 0) {
        stopTimer();
        toast('30 分钟完成。现在留下结果证据。');
      }
    }, 1000);
    renderTimer();
  });

  byId('timer-reset').addEventListener('click', () => {
    secondsLeft = 30 * 60;
    stopTimer();
  });

  byId('save-task').addEventListener('click', () => {
    if (!activeTask) return;
    try {
      store.saveTask(activeTask.id, readForm());
      renderAll();
      toast('进度已保存在当前浏览器。');
    } catch {
      showStorageWarning('可查看任务，但本机无法保存进度。请检查浏览器存储权限。');
      toast('保存失败，请检查浏览器存储权限。');
    }
  });

  byId('complete-task').addEventListener('click', () => {
    if (!activeTask) return;
    try {
      store.completeTask(activeTask.id, readForm());
      renderAll();
      dialog.close();
      toast('验收通过：结果证据已保存。');
    } catch (error) {
      if (String(error.message).includes('complete all steps')) {
        toast('请先勾完三步，并填写可核验的结果证据。');
        byId('evidence').focus();
      } else {
        showStorageWarning('可查看任务，但本机无法保存进度。请检查浏览器存储权限。');
        toast('保存失败，请检查浏览器存储权限。');
      }
    }
  });

  byId('prev-month').addEventListener('click', () => {
    calendarMonth -= 1;
    if (calendarMonth < 0) { calendarMonth = 11; calendarYear -= 1; }
    renderCalendar();
  });
  byId('next-month').addEventListener('click', () => {
    calendarMonth += 1;
    if (calendarMonth > 11) { calendarMonth = 0; calendarYear += 1; }
    renderCalendar();
  });

  byId('export-progress').addEventListener('click', () => {
    const blob = new Blob([store.exportState()], { type: 'application/json' });
    const link = root.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'mrcharm-growth-' + localDateISO() + '.json';
    link.click();
    URL.revokeObjectURL(link.href);
    toast('进度备份已导出。');
  });
  byId('import-progress').addEventListener('click', () => byId('import-file').click());
  byId('import-file').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      store.importState(await file.text());
      renderAll();
      toast('进度已导入并保存在本机。');
    } catch {
      toast('导入失败：文件不是有效的行动台备份。');
    } finally {
      event.target.value = '';
    }
  });
  byId('reset-progress').addEventListener('click', () => {
    if (!globalThis.confirm('确认清空当前浏览器里的全部任务记录？此操作无法撤销。')) return;
    try {
      store.resetState();
      renderAll();
      toast('本机记录已清空。');
    } catch {
      toast('清空失败，请检查浏览器存储权限。');
    }
  });

  const recovery = store.getRecoveryPayload();
  if (recovery) showStorageWarning('检测到损坏的旧进度，已安全回退为空白状态。请重新开始或导入备份。');
  renderTimer();
  renderAll();
  return { store, openTask, renderAll };
}

if (typeof document !== 'undefined' && document.querySelector('#action-data')) {
  try {
    initActionPage(document);
  } catch {
    const warning = document.querySelector('#storage-warning');
    if (warning) {
      warning.hidden = false;
      warning.textContent = '行动台未能启动。请刷新页面或检查浏览器是否允许本地存储。';
    }
  }
}
