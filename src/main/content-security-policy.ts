export function buildContentSecurityPolicy(development: boolean): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    `style-src 'self'${development ? " 'unsafe-inline'" : ''}`,
    "img-src 'self' data: blob: infinite-wall-media:",
    "font-src 'self' data:",
    `connect-src 'self'${development ? ' http://localhost:* ws://localhost:*' : ''}`,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}
