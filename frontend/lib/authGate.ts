const WILDCARD_PUBLIC_PATHS = ['/auth', '/api/webhooks'];
const EXACT_PUBLIC_PATHS = ['/cgu'];

export function isPublicPath(pathname: string): boolean {
  if (EXACT_PUBLIC_PATHS.includes(pathname)) return true;
  return WILDCARD_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
