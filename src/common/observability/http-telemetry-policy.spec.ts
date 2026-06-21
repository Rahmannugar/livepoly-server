import {
  getRequestPath,
  shouldIgnoreHttpTransaction,
  shouldSuppressHttpRequestLog,
} from './http-telemetry-policy';

describe('HTTP telemetry policy', () => {
  it.each([
    ['GET', '/health/live'],
    ['GET', '/health/ready?full=true'],
    ['GET', '/notifications/stream'],
    ['GET', '/rooms/stream/AbC12345'],
    ['GET', '/socket.io/?transport=websocket'],
    ['OPTIONS', '/rooms'],
  ])('suppresses %s %s', (method, url) => {
    expect(shouldSuppressHttpRequestLog(method, url)).toBe(true);
  });

  it('keeps bounded application requests observable', () => {
    expect(shouldSuppressHttpRequestLog('POST', '/rooms')).toBe(false);
    expect(shouldSuppressHttpRequestLog('GET', '/rooms/AbC12345')).toBe(false);
  });

  it('keeps realtime setup transactions while ignoring health probes', () => {
    expect(shouldIgnoreHttpTransaction('GET', '/health/live')).toBe(true);
    expect(shouldIgnoreHttpTransaction('GET', '/notifications/stream')).toBe(
      false,
    );
    expect(shouldIgnoreHttpTransaction('GET', '/rooms/stream/AbC12345')).toBe(
      false,
    );
    expect(
      shouldIgnoreHttpTransaction('GET', '/socket.io/?transport=websocket'),
    ).toBe(false);
  });

  it('normalizes query strings away from request paths', () => {
    expect(getRequestPath('/users/search?q=player')).toBe('/users/search');
  });
});
