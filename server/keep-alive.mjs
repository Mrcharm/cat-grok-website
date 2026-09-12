// Keeps the free Render instance from spinning down after ~15 minutes of idle.
//
// A ping only counts as activity when it travels out to the public URL and back,
// so we must hit RENDER_EXTERNAL_URL - pinging 127.0.0.1 never leaves the box.
// The instance cannot wake itself from sleep, so this prevents sleeping rather
// than curing it; the browser warm-up ping in duplex-controller.js wakes a
// sleeping instance when someone opens the site.

const PING_INTERVAL_MS = 10 * 60 * 1000;
const PING_TIMEOUT_MS = 25 * 1000;

// Free plan grants 750 instance-hours per workspace per month, and one always-on
// service eats ~720 of them. Staying warm 07:00-24:00 Asia/Shanghai (~510h) leaves
// headroom for redeploys and any other free service, and the cold-start window it
// leaves behind is the middle of the night.
export const WARM_WINDOW = Object.freeze({ startHour: 7, endHour: 24 });

export function resolveKeepAliveBaseUrl(env = process.env) {
  const explicit = env.KEEP_ALIVE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const external = env.RENDER_EXTERNAL_URL?.trim();
  if (external) return external.replace(/\/+$/, '');
  const hostname = env.RENDER_EXTERNAL_HOSTNAME?.trim();
  if (hostname) return `https://${hostname}`.replace(/\/+$/, '');
  return '';
}

// China has no daylight saving, so a fixed +8 offset is exact.
export function isWithinWarmWindow(date = new Date(), window = WARM_WINDOW) {
  const hour = (date.getUTCHours() + 8) % 24;
  return hour >= window.startHour && hour < window.endHour;
}

export function startKeepAlive({
  baseUrl,
  intervalMs = PING_INTERVAL_MS,
  window = WARM_WINDOW,
  log = console.log,
  warn = console.warn
} = {}) {
  const base = (baseUrl || '').replace(/\/+$/, '');
  if (!base) {
    log('[keep-alive] disabled: no public url in the environment');
    return null;
  }
  const url = `${base}/healthz`;
  let stopped = false;

  const ping = async () => {
    if (stopped) return;
    if (!isWithinWarmWindow(new Date(), window)) {
      log('[keep-alive] outside warm window, letting the instance idle');
      return;
    }
    const startedAt = Date.now();
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'jarvis-voice-keep-alive' },
        signal: AbortSignal.timeout(PING_TIMEOUT_MS)
      });
      log(`[keep-alive] ${response.status} ${url} ${Date.now() - startedAt}ms`);
    } catch (error) {
      warn(`[keep-alive] ping failed: ${error?.message || error}`);
    }
  };

  ping();
  const timer = setInterval(ping, intervalMs);
  timer.unref?.();

  return {
    url,
    intervalMs,
    stop() {
      stopped = true;
      clearInterval(timer);
    }
  };
}
