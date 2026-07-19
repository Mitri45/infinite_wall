import { describe, expect, it } from 'vitest';

import { buildContentSecurityPolicy } from './content-security-policy';

describe('buildContentSecurityPolicy', () => {
  it('keeps production scripts strict', () => {
    const policy = buildContentSecurityPolicy(false);

    expect(policy).toContain("script-src 'self'");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).not.toContain('localhost');
  });

  it('allows Vite styles and local connections without weakening scripts', () => {
    const policy = buildContentSecurityPolicy(true);

    expect(policy).toContain("script-src 'self'");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
    expect(policy).toContain('http://localhost:*');
    expect(policy).toContain('ws://localhost:*');
    expect(policy).not.toContain("'unsafe-eval'");
  });
});
