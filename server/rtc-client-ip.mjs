import { BlockList, isIP } from 'node:net';

const normalizeIp = value => {
  if (typeof value !== 'string' || value.includes('%') || !isIP(value)) return null;
  if (isIP(value) === 4) return value;
  const canonical = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  const mapped = /^::ffff:([a-f0-9]+):([a-f0-9]+)$/.exec(canonical);
  if (!mapped) return canonical;
  const high = parseInt(mapped[1], 16);
  const low = parseInt(mapped[2], 16);
  return [high >> 8, high & 255, low >> 8, low & 255].join('.');
};

export function createClientIpResolver({ mode = 'direct', trustedProxyCidrs = [] } = {}) {
  if (!['direct', 'trusted-proxy'].includes(mode)) throw new Error('Invalid client IP mode');
  const proxies = new BlockList();
  for (const cidr of trustedProxyCidrs) {
    const parts = cidr.split('/');
    const family = isIP(parts[0]);
    const prefix = Number(parts[1]);
    if (parts.length !== 2 || !family || parts[0].includes('%') || !/^\d+$/.test(parts[1])
      || prefix <= 0 || prefix > (family === 4 ? 32 : 128)) {
      throw new Error('Invalid trusted proxy CIDR');
    }
    proxies.addSubnet(parts[0], prefix, family === 4 ? 'ipv4' : 'ipv6');
  }
  const trusted = ip => proxies.check(ip, isIP(ip) === 4 ? 'ipv4' : 'ipv6');
  return request => {
    const peer = normalizeIp(request.socket.remoteAddress);
    if (!peer) return null;
    if (mode === 'direct') return peer;
    // RENDER is not proof that arbitrary forwarding metadata is trustworthy.
    if (!trusted(peer)) return null;
    const header = request.headers['x-forwarded-for'];
    if (typeof header !== 'string' || header.length > 4096) return null;
    const chain = header.split(',').map(value => normalizeIp(value.trim()));
    if (chain.length > 32 || chain.some(ip => !ip)) return null;
    // Walk from the socket's trusted end; never consume attacker-prepended IPs.
    for (let index = chain.length - 1; index >= 0; index -= 1) {
      if (!trusted(chain[index])) return chain[index];
    }
    return null;
  };
}
