import { initArticlesPage } from './articles.js';
import { initSkillsPage } from './skills.js';
import { bootDuplexVoice } from './voice/duplex-controller.js?v=20260906b';

const INITIALIZERS = {
  home: root => {
    const voice = bootDuplexVoice({ root });
    return () => voice?.destroy();
  },
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

