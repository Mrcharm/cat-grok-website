import { createPageLifecycle } from './page-lifecycle.js?v=20260906b';

const ROUTES = new Map([
  ['/', 'home'],
  ['/index.html', 'home'],
  ['/articles/', 'articles'],
  ['/skills/', 'skills'],
  ['/portfolio/', 'portfolio']
]);
const ROUTE_PATHS = new Map([
  ['home', ''],
  ['articles', 'articles/'],
  ['skills', 'skills/'],
  ['portfolio', 'portfolio/']
]);

function routePath(url) {
  let path = new URL(url, 'https://local.invalid/').pathname;
  const projectRoot = '/cat-grok-website';
  if (path === projectRoot) path = '/';
  else if (path.startsWith(projectRoot + '/')) path = path.slice(projectRoot.length);
  if (!path.startsWith('/')) path = '/' + path;
  return path;
}

export function routeKey(url) {
  return ROUTES.get(routePath(url)) || null;
}

export function routeHref(route, currentHref) {
  const current = new URL(currentHref);
  const marker = '/cat-grok-website/';
  const markerIndex = current.pathname.indexOf(marker);
  const basePath = markerIndex >= 0
    ? current.pathname.slice(0, markerIndex) + marker
    : '/';
  return new URL(basePath + ROUTE_PATHS.get(route), current.origin).href;
}

export function linkRoute(link) {
  return link.dataset?.route || routeKey(link.href);
}

const FLOWERS_URL = 'https://music.163.com/outchain/player?type=2&id=2086327879&auto=1&height=32';

export function createMusicController({
  root = document,
  interactionTarget = document
} = {}) {
  const button = root.querySelector('.music-btn');
  if (!root.querySelector('#background-music-frame') || !button) {
    return { start() {}, toggle() {}, play() {}, stop() {}, destroy() {} };
  }

  let playing = true;
  let started = false;

  function frame() {
    return root.querySelector('#background-music-frame');
  }

  function replaceFrame(src = FLOWERS_URL) {
    const current = frame();
    const next = current.cloneNode(false);
    next.src = src;
    current.replaceWith(next);
    return next;
  }

  function renderState() {
    button.setAttribute('aria-pressed', String(playing));
    button.setAttribute('aria-label', playing ? '停止背景音乐：《鲜花》' : '播放背景音乐：《鲜花》');
    button.classList[playing ? 'add' : 'remove']('playing');
  }

  function detachGestureRecovery() {
    interactionTarget.removeEventListener('pointerdown', recoverAfterGesture);
    interactionTarget.removeEventListener('keydown', recoverAfterGesture);
  }

  function play() {
    playing = true;
    replaceFrame();
    renderState();
    detachGestureRecovery();
  }

  function stop() {
    playing = false;
    frame().src = 'about:blank';
    renderState();
    detachGestureRecovery();
  }

  function toggle() {
    if (playing) stop();
    else play();
  }

  function recoverAfterGesture() {
    if (playing) replaceFrame();
    detachGestureRecovery();
  }

  function start() {
    if (started) return;
    started = true;
    button.addEventListener('click', toggle);
    interactionTarget.addEventListener('pointerdown', recoverAfterGesture);
    interactionTarget.addEventListener('keydown', recoverAfterGesture);
    playing = true;
    frame().src = FLOWERS_URL;
    renderState();
  }

  function destroy() {
    if (!started) return;
    button.removeEventListener('click', toggle);
    detachGestureRecovery();
    started = false;
  }

  return { start, toggle, play, stop, destroy };
}

export function initSiteNavigation(root = document, view = window) {
  const button = root.querySelector('.menu-button');
  const nav = root.querySelector('#site-nav');
  if (!button || !nav) return () => {};

  const toggle = () => {
    const open = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!open));
    nav.dataset.open = String(!open);
  };
  const closeMobile = () => {
    if (view.getComputedStyle(button).display !== 'none') {
      button.setAttribute('aria-expanded', 'false');
      nav.dataset.open = 'false';
    }
  };
  const resize = () => {
    if (view.getComputedStyle(button).display === 'none') {
      button.setAttribute('aria-expanded', 'false');
      nav.dataset.open = 'false';
    }
  };

  button.addEventListener('click', toggle);
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMobile));
  view.addEventListener('resize', resize);

  return () => {
    button.removeEventListener?.('click', toggle);
    nav.querySelectorAll('a').forEach(link => link.removeEventListener?.('click', closeMobile));
    view.removeEventListener?.('resize', resize);
  };
}

function parseBrowserPage(html, url) {
  const next = new DOMParser().parseFromString(html, 'text/html');
  const main = next.querySelector('main');
  if (!main) throw new Error('missing main');
  return {
    main,
    title: next.title,
    description: next.querySelector('meta[name="description"]')?.content || '',
    canonical: next.querySelector('link[rel="canonical"]')?.href || url,
    bodyClass: next.body.className,
    route: routeKey(url)
  };
}

function renderBrowserPage(page, root = document) {
  root.querySelector('main').replaceWith(page.main);
  root.title = page.title;
  root.body.className = page.bodyClass;
  const description = root.querySelector('meta[name="description"]');
  if (description) description.content = page.description;
  const canonical = root.querySelector('link[rel="canonical"]');
  if (canonical) canonical.href = page.canonical;
  root.querySelectorAll('#site-nav a').forEach(link => {
    if (linkRoute(link) === page.route) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

export function createSiteNavigator({
  location = window.location,
  history = window.history,
  fetchImpl = window.fetch.bind(window),
  parsePage = parseBrowserPage,
  renderPage = renderBrowserPage,
  lifecycle = createPageLifecycle(),
  assign = href => window.location.assign(href),
  view = typeof window === 'undefined' ? null : window,
  root = typeof document === 'undefined' ? null : document
} = {}) {
  let controller = null;
  let started = false;
  let currentRoute = routeKey(location.href);
  const pageCache = new Map();
  if (root?.querySelector) pageCache.set(currentRoute, root.querySelector('main'));

  async function navigate(input, { push = true } = {}) {
    const url = new URL(input, location.href);
    const targetRoute = routeKey(url.href);
    if (!targetRoute || url.origin !== new URL(location.href).origin) return false;

    controller?.abort();
    controller = new AbortController();

    try {
      let page;
      if (pageCache.has(targetRoute)) {
        page = { main: pageCache.get(targetRoute), title: '', description: '', canonical: url.href, bodyClass: targetRoute === 'home' ? 'home-page jarvis-home' : '', route: targetRoute };
        if (root) {
          const response = await fetchImpl(url.href, { signal: controller.signal });
          if (!response.ok) throw new Error('navigation ' + response.status);
          const metadata = parsePage(await response.text(), url.href);
          page = { ...metadata, main: page.main };
        }
      } else {
        const response = await fetchImpl(url.href, { signal: controller.signal });
        if (!response.ok) throw new Error('navigation ' + response.status);
        page = parsePage(await response.text(), url.href);
      }

      if (root?.querySelector) pageCache.set(currentRoute, root.querySelector('main'));
      lifecycle.deactivate();
      renderPage(page);
      pageCache.set(targetRoute, page.main);
      currentRoute = targetRoute;
      if (push) history.pushState({ path: url.pathname }, '', url.href);
      lifecycle.activate(targetRoute, root);
      view?.scrollTo?.({ top: 0, behavior: 'instant' });
      root?.querySelector?.('main h1')?.focus?.({ preventScroll: true });
      return true;
    } catch (error) {
      if (error?.name === 'AbortError') return false;
      assign(url.href);
      return false;
    }
  }

  function handleClick(event) {
    const link = event.target.closest?.('a');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const route = linkRoute(link);
    if (link.target || link.hasAttribute('download') || !route) return;
    event.preventDefault();
    const target = link.dataset.route ? routeHref(route, location.href) : link.href;
    navigate(target);
  }

  function handlePopState() {
    navigate(location.href, { push: false });
  }

  function start() {
    if (started || !root || !view) return;
    started = true;
    root.addEventListener('click', handleClick);
    view.addEventListener('popstate', handlePopState);
    lifecycle.activate(currentRoute, root);
  }

  function destroy() {
    controller?.abort();
    if (!started || !root || !view) return;
    root.removeEventListener('click', handleClick);
    view.removeEventListener('popstate', handlePopState);
    lifecycle.deactivate();
    started = false;
  }

  return { start, navigate, destroy };
}

// Skill downloads — event delegation so dynamically rendered cards work too
export function initSkillDownloads() {
  const base = location.pathname.includes('/cat-grok-website')
    ? '/cat-grok-website/'
    : '/';

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;

    const skillBtn = target.closest('.dl-btn[data-skill]');
    if (skillBtn) {
      event.preventDefault();
      const name = skillBtn.getAttribute('data-skill');
      window.open(base + 'content/skills/' + name + '/SKILL.md', '_blank');
      return;
    }

    const zipBtn = target.closest('.dl-btn[data-zip]');
    if (zipBtn) {
      event.preventDefault();
      const name = zipBtn.getAttribute('data-zip');
      const file = name + '.zip';
      const link = document.createElement('a');
      link.href = base + 'downloads/skills/' + file;
      link.download = file;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  });
}

if (typeof document !== 'undefined') {
  initSiteNavigation();
  initSkillDownloads();
  createSiteNavigator().start();
  createMusicController().start();
}
