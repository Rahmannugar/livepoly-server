const HEALTH_PATHS = new Set(['/health/live', '/health/ready']);

const QUIET_HTTP_PATHS = new Set([...HEALTH_PATHS, '/notifications/stream']);

export function shouldSuppressHttpRequestLog(
  method: string | undefined,
  url: string | undefined,
): boolean {
  if (method === 'OPTIONS') {
    return true;
  }

  const path = getRequestPath(url);

  return (
    QUIET_HTTP_PATHS.has(path) ||
    path.startsWith('/rooms/stream/') ||
    path.startsWith('/socket.io/')
  );
}

export function shouldIgnoreHttpTransaction(
  method: string | undefined,
  url: string | undefined,
): boolean {
  if (method === 'OPTIONS') {
    return true;
  }

  return HEALTH_PATHS.has(getRequestPath(url));
}

export function getRequestPath(url: string | undefined): string {
  return (url ?? '/').split('?', 1)[0] || '/';
}
