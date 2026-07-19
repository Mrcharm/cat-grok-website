import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const readJson = async file => JSON.parse(await readFile(file, 'utf8'));

const requireText = (value, label, min = 1) => {
  if (typeof value !== 'string' || value.trim().length < min) {
    throw new Error(label + ' must be a non-empty string');
  }
};

export async function loadAndValidateContent() {
  const [profile, roadmap, tasks] = await Promise.all([
    readJson('data/profile.json'),
    readJson('data/roadmap.json'),
    readJson('data/tasks.json')
  ]);

  if (profile.lifeLines?.length !== 3) {
    throw new Error('profile.lifeLines must contain 3 items');
  }
  if (roadmap.years?.length !== 5) {
    throw new Error('roadmap.years must contain 5 stages');
  }
  if (!Array.isArray(tasks) || tasks.length !== 30) {
    throw new Error('tasks must contain 30 items');
  }

  const ids = new Set();
  const assets = new Set(['influence', 'income', 'technical', 'life']);
  for (const task of tasks) {
    if (ids.has(task.id)) throw new Error('duplicate task id: ' + task.id);
    ids.add(task.id);
    requireText(task.id, 'task.id');
    requireText(task.date, 'task.date');
    requireText(task.title, 'task.title');
    if (!assets.has(task.asset)) throw new Error(task.id + ' has invalid asset');
    requireText(task.why, 'task.why', 12);
    requireText(task.deliverable, 'task.deliverable', 8);
    requireText(task.method, 'task.method', 8);
    requireText(task.completion, 'task.completion', 8);
    if (!Array.isArray(task.steps) || task.steps.length !== 3) {
      throw new Error(task.id + ' must have 3 steps');
    }
    if (!Array.isArray(task.resources) || task.resources.length < 1) {
      throw new Error(task.id + ' needs resources');
    }
    for (const resource of task.resources) {
      requireText(resource.label, task.id + '.resource.label');
      requireText(resource.url, task.id + '.resource.url');
    }
  }

  return { profile, roadmap, tasks };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await loadAndValidateContent();
  console.log('content: profile, roadmap and 30 tasks are valid');
}
