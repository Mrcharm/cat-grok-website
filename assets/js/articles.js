function handleArticleFilter(event) {
  const chip = event.target.closest?.('.chip');
  if (!chip) return;
  const root = chip.closest('.page-wrap') || document;
  root.querySelectorAll('.chip').forEach(item => item.classList.remove('active'));
  chip.classList.add('active');
  const category = chip.dataset.cat;
  root.querySelectorAll('.blog-card').forEach(card => {
    const cardCategory = card.querySelector('.blog-cat')?.textContent || '';
    card.style.display = category === 'all' || cardCategory === category ? '' : 'none';
  });
}

export function initArticlesPage(root = document) {
  const filters = root.querySelector('.filters');
  if (!filters || filters.dataset.initialized === 'true') return null;
  filters.dataset.initialized = 'true';
  filters.addEventListener('click', handleArticleFilter);
  return () => {
    filters.removeEventListener('click', handleArticleFilter);
    delete filters.dataset.initialized;
  };
}

