import { initArticlesPage } from './articles.js';
import { initSkillsPage } from './skills.js?v=20260906e';
import { initPortfolioPage } from './portfolio.js?v=20260906e';
import { bootDuplexVoice } from './voice/duplex-controller.js?v=20260906e';

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

