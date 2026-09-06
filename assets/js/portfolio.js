// 作品集：截图点击放大预览（lightbox）
export function initPortfolioPage(root = document) {
  const wrap = root.querySelector('.page-wrap[data-page-module="portfolio"]');
  if (!wrap || wrap.dataset.initialized === 'true') return null;
  wrap.dataset.initialized = 'true';

  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = '<img alt="预览大图"><button class="lightbox-close" type="button" aria-label="关闭预览">×</button>';
  document.body.appendChild(overlay);

  const img = overlay.querySelector('img');

  function open(src, alt) {
    img.src = src;
    img.alt = alt || '预览大图';
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    img.src = '';
  }

  function onClick(event) {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    const thumb = target.closest('.portfolio-thumbs img');
    if (thumb) {
      event.preventDefault();
      open(thumb.getAttribute('src'), thumb.getAttribute('alt'));
      return;
    }
    if (target.closest('.lightbox-close') || target === overlay) close();
  }

  function onKey(event) {
    if (event.key === 'Escape' && overlay.classList.contains('open')) close();
  }

  wrap.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);

  return () => {
    wrap.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    document.body.style.overflow = '';
    delete wrap.dataset.initialized;
  };
}
