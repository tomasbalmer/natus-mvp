import { describe, expect, it } from 'vitest';
import { allowOrigin, parseAllowedOrigins } from './cors.ts';

const ALLOWED = ['https://tomasbalmer.github.io', 'http://localhost:5173'];

describe('allowOrigin', () => {
  it('echoes an origin on the list', () => {
    expect(allowOrigin('http://localhost:5173', ALLOWED)).toBe('http://localhost:5173');
  });

  it('returns null for an origin that is not', () => {
    // Null means "send no header", not "send something else". Naming a
    // different origin would be a lie to the browser.
    expect(allowOrigin('https://evil.example', ALLOWED)).toBeNull();
  });

  it('never returns a wildcard', () => {
    for (const origin of [null, '', '*', 'https://evil.example']) {
      expect(allowOrigin(origin, ALLOWED)).not.toBe('*');
    }
  });

  it('does not match on prefix', () => {
    // github.io origins are a shared subdomain already; matching loosely
    // would widen it further to anyone who can register a lookalike host.
    expect(allowOrigin('https://tomasbalmer.github.io.evil.example', ALLOWED)).toBeNull();
    expect(allowOrigin('https://tomasbalmer.github.i', ALLOWED)).toBeNull();
  });

  it('ignores the path, because an origin has none', () => {
    // The site lives at /natus-mvp/ and the browser will never send that.
    // An entry written with a path simply matches nothing.
    expect(allowOrigin('https://tomasbalmer.github.io', ['https://tomasbalmer.github.io/natus-mvp/']))
      .toBeNull();
  });

  it('is empty-list safe', () => {
    expect(allowOrigin('http://localhost:5173', [])).toBeNull();
  });
});

describe('parseAllowedOrigins', () => {
  it('splits and trims', () => {
    expect(parseAllowedOrigins(' https://a.example , https://b.example ')).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });

  it('drops empty entries', () => {
    // A trailing comma would otherwise produce an entry that matches the
    // empty origin, which is what a same-origin or file:// request sends.
    expect(parseAllowedOrigins('https://a.example,,')).toEqual(['https://a.example']);
  });

  it('treats unset as no origins rather than as all of them', () => {
    expect(parseAllowedOrigins(undefined)).toEqual([]);
    expect(parseAllowedOrigins('')).toEqual([]);
  });
});
