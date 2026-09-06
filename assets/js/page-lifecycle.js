import { initArticlesPage } from './articles.js';
import { initSkillsPage } from './skills.js';
import { initPortfolioPage } from './portfolio.js';
import { bootDuplexVoice } from './voice/duplex-controller.js?v=20260906c';

const INITIALIZERS = {
  home: root => {
    const voice = bootDuplexVoice({ root });
    return () => voice?.destroy();
  },
  articles: initArticlesPage,
  skills: initSkillsPage,
  portfolio: initPortfolioPage
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

