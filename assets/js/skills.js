function handleSkillAction(event) {
  const button = event.target.closest?.('.dl-btn');
  if (!button) return;
  const skill = button.dataset.zip || button.dataset.skill;
  const action = button.dataset.zip ? '打包下载' : '下载';
  window.alert(action + ' ' + skill + '\n\n功能即将上线，当前为预览版本。');
}

export function initSkillsPage(root = document) {
  const library = root.querySelector('.page-wrap[data-page-module="skills"]');
  if (!library || library.dataset.initialized === 'true') return null;
  library.dataset.initialized = 'true';
  library.addEventListener('click', handleSkillAction);
  return () => {
    library.removeEventListener('click', handleSkillAction);
    delete library.dataset.initialized;
  };
}

