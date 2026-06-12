import { describe, it, expect } from 'vitest';
import { isPrivateIp } from './storageService.js';

describe('isPrivateIp — SSRF private/reserved guard', () => {
  it('blocks IPv4 loopback / private / metadata ranges', () => {
    for (const ip of [
      '127.0.0.1', '10.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.1.1',
      '169.254.169.254', // cloud metadata
      '100.64.0.1',      // CGNAT
      '0.0.0.0',
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it('blocks newly-covered reserved IPv4 ranges (benchmark, multicast, reserved, broadcast)', () => {
    for (const ip of ['198.18.0.1', '198.19.1.1', '224.0.0.1', '239.255.255.250', '240.0.0.1', '255.255.255.255']) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it('blocks IPv6 loopback, ULA, and the FULL fe80::/10 link-local range', () => {
    for (const ip of [
      '::1', '::',
      'fc00::1', 'fd12:3456::1',     // ULA
      'fe80::1',                     // link-local (was already caught)
      'fe9a::1', 'fea0::1', 'febf::1', // link-local fe80::/10 — MISSED before this fix
      'ff02::1',                     // multicast
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it('blocks IPv4-mapped loopback in dotted form', () => {
    expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateIp('::ffff:169.254.169.254')).toBe(true);
  });

  it('allows genuine public addresses', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '203.0.113.10', '2606:4700:4700::1111']) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });
});
