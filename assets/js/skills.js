function initSkillsPage(root = document) {
  // 下载交互由 site.js 的 initSkillDownloads（document 级事件委托）处理，
  // 此处不再挂 alert 占位 —— 曾与真实下载冲突（弹"功能即将上线"）。
  const library = root.querySelector('.page-wrap[data-page-module="skills"]');
  if (!library || library.dataset.initialized === 'true') return null;
  library.dataset.initialized = 'true';
  return () => {
    delete library.dataset.initialized;
  };
}
