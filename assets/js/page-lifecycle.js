import { initArticlesPage } from './articles.js';
import { initSkillsPage } from './skills.js';

const INITIALIZERS = {
  articles: initArticlesPage,
  skills: initSkillsPage
};

export function createPageLifecycle() {
  let cleanup = null;

  return {
    deactivate() {
      cleanup?.();
      cleanup = null;
    },
    activate(route, root = document) {
      cleanup?.();
      cleanup = INITIALIZERS[route]?.(root) || null;
    }
  };
}

